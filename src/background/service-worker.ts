import { pipeline, env } from '@huggingface/transformers';
import embeddingsData from '../assets/embeddings.json';

// Configure environment for Chrome Extension environment
env.allowLocalModels = false;

// Set default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    ecoPromptEnabled: true,
    mlClassificationEnabled: true,
    sensitivityThreshold: 0.6,
    queriesDiverted: 0,
    tokensSaved: 0,
    co2Saved: 0.0,
    modelStatus: 'idle',
    modelProgress: 0,
  };
  
  const existing = await chrome.storage.local.get(Object.keys(defaults));
  const toSet: Record<string, any> = {};
  for (const [key, val] of Object.entries(defaults)) {
    if (existing[key] === undefined) {
      toSet[key] = val;
    }
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }
  
  // Try pre-loading model
  try {
    await loadModels();
  } catch (err) {
    console.error('Failed to pre-load models:', err);
  }
});

let classifierPromise: Promise<any> | null = null;
let classifier: any = null;
let extractorPromise: Promise<any> | null = null;
let extractor: any = null;

async function loadModels(): Promise<{classifier: any, extractor: any}> {
  if (classifier && extractor) return { classifier, extractor };
  
  if (!classifierPromise) {
    classifierPromise = (async () => {
      try {
        await chrome.storage.local.set({ modelStatus: 'downloading', modelProgress: 0 });
        const loaded = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall', {
          device: 'wasm',
          progress_callback: (data: any) => {
            if (data.status === 'progress') {
              chrome.storage.local.set({ modelProgress: Math.round(data.progress || 0) / 2 });
            }
          }
        });
        classifier = loaded;
        return loaded;
      } catch (err) {
        console.error('Error loading classifier:', err);
        throw err;
      }
    })();
  }
  
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        const loaded = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          device: 'wasm',
          progress_callback: (data: any) => {
            if (data.status === 'progress') {
              chrome.storage.local.set({ modelProgress: 50 + Math.round(data.progress || 0) / 2 });
            }
          }
        });
        extractor = loaded;
        return loaded;
      } catch (err) {
        console.error('Error loading extractor:', err);
        throw err;
      }
    })();
  }

  try {
    await Promise.all([classifierPromise, extractorPromise]);
    await chrome.storage.local.set({ modelStatus: 'ready', modelProgress: 100 });
    return { classifier, extractor };
  } catch (error) {
    await chrome.storage.local.set({ modelStatus: 'error', modelProgress: 0 });
    classifierPromise = null;
    extractorPromise = null;
    throw error;
  }
}

function cosineSimilarity(a: any, b: any) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Intercept messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLASSIFY_PROMPT') {
    handleClassification(message.text)
      .then(sendResponse)
      .catch((err) => {
        console.error('Classification error:', err);
        sendResponse({ intercept: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'TRIGGER_DOWNLOAD') {
    loadModels()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'RECORD_DIVERSION') {
    handleRecordDiversion(message.text)
      .then(sendResponse);
    return true;
  }
});

async function handleClassification(text: string) {
  const settings = await chrome.storage.local.get([
    'ecoPromptEnabled',
    'mlClassificationEnabled',
    'sensitivityThreshold',
    'modelStatus'
  ]);

  if (!settings.ecoPromptEnabled || !settings.mlClassificationEnabled) {
    return { intercept: false, reason: 'disabled' };
  }

  if (settings.modelStatus !== 'ready') {
    // Model not loaded yet, try downloading in background
    loadModels().catch(() => {});
    return { intercept: false, reason: 'model_not_ready' };
  }

  try {
    const { classifier: model, extractor } = await loadModels();
    
    // 1. Semantic Similarity Search against dataset
    const extractionResult = await extractor(text, { pooling: 'mean', normalize: true });
    const textEmbedding = Array.from(extractionResult.data);
    
    let maxSimilarity = 0;
    let matchedPrompt = '';
    
    for (const item of embeddingsData) {
      const similarity = cosineSimilarity(textEmbedding, item.embedding);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedPrompt = item.text;
      }
    }
    
    // If highly similar (e.g. > 0.85) to an unwanted prompt, intercept
    if (maxSimilarity > 0.85) {
      return {
        intercept: true,
        score: maxSimilarity,
        label: `similar to unwanted dataset: "${matchedPrompt}"`,
        threshold: 0.85
      };
    }
    
    // 2. Fall back to Zero-shot Classification
    
    // More granular candidate labels for better zero-shot accuracy
    const simpleLabels = [
      'math calculation or arithmetic',
      'simple web search or factual query',
      'basic question with a straightforward answer',
      'task that does not require AI generation'
    ];
    const complexLabels = [
      'complex task requiring AI generation or deep reasoning',
      'creative writing, coding, or brainstorming'
    ];
    
    const candidateLabels = [...simpleLabels, ...complexLabels];
    
    const result = await model(text, candidateLabels);
    
    // Sum the scores of all simple labels
    let simpleScore = 0;
    for (let i = 0; i < result.labels.length; i++) {
      if (simpleLabels.includes(result.labels[i])) {
        simpleScore += result.scores[i];
      }
    }
    
    const threshold = settings.sensitivityThreshold || 0.6;
    const intercept = simpleScore >= threshold;
    
    return {
      intercept,
      score: simpleScore,
      label: result.labels[0], // Return the top matched label for debugging/logging
      threshold
    };
  } catch (err) {
    console.error('Error running classifier:', err);
    return { intercept: false, error: (err as Error).message };
  }
}

async function handleRecordDiversion(text: string) {
  const stats = await chrome.storage.local.get(['queriesDiverted', 'tokensSaved', 'co2Saved']);
  
  const currentDiverted = (stats.queriesDiverted || 0) + 1;
  
  // Estimate tokens: prompt chars / 4 + ~150 response tokens
  const promptTokens = Math.ceil((text || '').length / 4);
  const responseTokensEstimate = 150;
  const totalTokensSaved = (stats.tokensSaved || 0) + promptTokens + responseTokensEstimate;
  
  // Estimate CO2 saved: ~0.3 grams of CO2 saved per avoided query
  const co2SavedValue = parseFloat(((stats.co2Saved || 0.0) + 0.3).toFixed(2));
  
  await chrome.storage.local.set({
    queriesDiverted: currentDiverted,
    tokensSaved: totalTokensSaved,
    co2Saved: co2SavedValue
  });
  
  return { success: true, queriesDiverted: currentDiverted, tokensSaved: totalTokensSaved, co2Saved: co2SavedValue };
}
