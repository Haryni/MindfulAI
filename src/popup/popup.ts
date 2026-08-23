// EcoPrompt Popup Controller - MindfulAI

document.addEventListener('DOMContentLoaded', () => {
  // Stats Elements
  const statsDiverted = document.getElementById('stats-diverted')!;
  const statsTokens = document.getElementById('stats-tokens')!;
  const statsCo2 = document.getElementById('stats-co2')!;
  
  const goalPercentText = document.getElementById('goal-percent-text')!;
  const goalBarFill = document.getElementById('goal-bar-fill') as HTMLElement;

  const equivBulb = document.getElementById('equiv-bulb')!;
  const equivKm = document.getElementById('equiv-km')!;
  const equivTrees = document.getElementById('equiv-trees')!;

  // Header & Status Tag
  const statusTag = document.getElementById('status-tag')!;
  const statusTagText = document.getElementById('status-tag-text')!;

  // Search Engine Hub
  const engineTabs = document.querySelectorAll('.engine-tab');
  const searchInput = document.getElementById('popup-search-input') as HTMLInputElement;
  const searchBtn = document.getElementById('popup-search-btn') as HTMLButtonElement;
  let activeEngine = 'ecosia';

  // Test Classifier Playground
  const testInput = document.getElementById('test-prompt-input') as HTMLInputElement;
  const testBtn = document.getElementById('test-prompt-btn') as HTMLButtonElement;
  const testResult = document.getElementById('test-prompt-result') as HTMLElement;

  // Controls
  const toggleShield = document.getElementById('toggle-shield') as HTMLInputElement;
  const toggleMl = document.getElementById('toggle-ml') as HTMLInputElement;
  const sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
  const sensitivityDisplay = document.getElementById('sensitivity-display')!;
  
  const toggleChatgpt = document.getElementById('toggle-chatgpt') as HTMLInputElement;
  const toggleClaude = document.getElementById('toggle-claude') as HTMLInputElement;
  const toggleGemini = document.getElementById('toggle-gemini') as HTMLInputElement;

  const chipChatgpt = document.getElementById('chip-chatgpt')!;
  const chipClaude = document.getElementById('chip-claude')!;
  const chipGemini = document.getElementById('chip-gemini')!;

  // Model Engine UI
  const modelBadge = document.getElementById('model-badge')!;
  const modelDetails = document.getElementById('model-details')!;
  const modelProgressContainer = document.getElementById('model-progress-container') as HTMLElement;
  const modelProgressBar = document.getElementById('model-progress-bar') as HTMLElement;
  const modelDownloadBtn = document.getElementById('model-download-btn') as HTMLButtonElement;
  const resetStatsBtn = document.getElementById('reset-stats-btn') as HTMLButtonElement;

  function updateEcoEquivalents(co2Grams: number) {
    const bulbHours = (co2Grams / 10).toFixed(1);
    const kmDriven = (co2Grams / 120).toFixed(3);
    const trees = (co2Grams / 60).toFixed(2);

    equivBulb.innerText = bulbHours;
    equivKm.innerText = kmDriven;
    equivTrees.innerText = trees;

    // Update Daily Goal (Goal: 5.0g CO2)
    const goalTarget = 5.0;
    const pct = Math.min(100, Math.round((co2Grams / goalTarget) * 100));
    goalPercentText.innerText = `${pct}%`;
    goalBarFill.style.width = `${pct}%`;
  }

  function updateShieldStatusBadge(enabled: boolean) {
    if (enabled) {
      statusTag.style.background = 'rgba(16, 185, 129, 0.1)';
      statusTag.style.borderColor = 'rgba(16, 185, 129, 0.25)';
      statusTag.style.color = '#34d399';
      statusTagText.innerText = 'Active';
    } else {
      statusTag.style.background = 'rgba(239, 68, 68, 0.1)';
      statusTag.style.borderColor = 'rgba(239, 68, 68, 0.25)';
      statusTag.style.color = '#f87171';
      statusTagText.innerText = 'Paused';
    }
  }

  function syncPlatformChipUI() {
    chipChatgpt.classList.toggle('active', toggleChatgpt.checked);
    chipClaude.classList.toggle('active', toggleClaude.checked);
    chipGemini.classList.toggle('active', toggleGemini.checked);
  }

  // Load and display current values from storage
  chrome.storage.local.get([
    'ecoPromptEnabled',
    'mlClassificationEnabled',
    'sensitivityThreshold',
    'enableChatgpt',
    'enableClaude',
    'enableGemini',
    'queriesDiverted',
    'tokensSaved',
    'co2Saved',
    'modelStatus',
    'modelProgress'
  ], (res) => {
    // Stats
    const diverted = res.queriesDiverted || 0;
    const co2 = res.co2Saved || 0.0;
    statsDiverted.innerText = String(diverted);
    statsTokens.innerText = String(res.tokensSaved || 0);
    statsCo2.innerText = Number(co2).toFixed(2);
    updateEcoEquivalents(co2);

    // Controls
    const shieldOn = res.ecoPromptEnabled !== false;
    toggleShield.checked = shieldOn;
    updateShieldStatusBadge(shieldOn);

    toggleMl.checked = res.mlClassificationEnabled !== false;
    
    toggleChatgpt.checked = res.enableChatgpt !== false;
    toggleClaude.checked = res.enableClaude !== false;
    toggleGemini.checked = res.enableGemini !== false;
    syncPlatformChipUI();

    const sensitivity = res.sensitivityThreshold !== undefined ? res.sensitivityThreshold : 0.45;
    sensitivitySlider.value = String(sensitivity);
    sensitivityDisplay.innerText = Number(sensitivity).toFixed(2);

    // Model status
    updateModelUI(res.modelStatus || 'idle', res.modelProgress || 0);
  });

  // Watch for live storage updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.queriesDiverted || changes.co2Saved) {
      chrome.storage.local.get(['queriesDiverted', 'co2Saved'], (r) => {
        const div = r.queriesDiverted || 0;
        const c2 = r.co2Saved || 0.0;
        statsDiverted.innerText = String(div);
        statsCo2.innerText = Number(c2).toFixed(2);
        updateEcoEquivalents(c2);
      });
    }
    if (changes.tokensSaved) {
      statsTokens.innerText = String(changes.tokensSaved.newValue);
    }
    
    if (changes.modelStatus || changes.modelProgress) {
      const status = changes.modelStatus ? changes.modelStatus.newValue : undefined;
      const progress = changes.modelProgress ? changes.modelProgress.newValue : undefined;
      
      chrome.storage.local.get(['modelStatus', 'modelProgress'], (res) => {
        updateModelUI(status || res.modelStatus || 'idle', progress !== undefined ? progress : (res.modelProgress || 0));
      });
    }
  });

  // Search Engine Selector Handler
  engineTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      engineTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeEngine = (tab as HTMLElement).dataset.engine || 'ecosia';
    });
  });

  function performEcoSearch() {
    const q = searchInput.value.trim();
    if (!q) return;
    
    let url = `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`;
    if (activeEngine === 'ddg') {
      url = `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
    } else if (activeEngine === 'ocean') {
      url = `https://search.oceanhero.today/search?q=${encodeURIComponent(q)}`;
    } else if (activeEngine === 'google') {
      url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    }

    chrome.tabs.create({ url });
  }

  searchBtn.onclick = performEcoSearch;
  searchInput.onkeydown = (e) => {
    if (e.key === 'Enter') performEcoSearch();
  };

  // Test Classifier Playground Handler
  function runTestClassification() {
    const text = testInput.value.trim();
    if (!text) return;

    testResult.style.display = 'block';
    testResult.innerHTML = '<span style="color: #38bdf8;">⚡ Analyzing query...</span>';

    // Check basic regex heuristics first
    const basicMath = /^\s*[-+]?\(?\d+(?:\.\d+)?\)?\s*[\+\-\*\/]\s*\(?\d+(?:\.\d+)?\)?/.test(text) || /^(?:calculate|calc|what is \d+)/i.test(text);
    const basicDef = /^(?:meaning of|define|what is a|definition of)\s+\S+/i.test(text);
    const basicFact = /^(?:who is|who was|where is|when was)\s+/i.test(text);

    if (basicMath || basicDef || basicFact) {
      const type = basicMath ? 'Arithmetic Math' : basicDef ? 'Dictionary Definition' : 'Factual Search';
      testResult.innerHTML = `
        <div style="color: #34d399; font-weight: 700;">🛡️ INTERCEPT (Heuristic Match)</div>
        <div style="margin-top: 2px;">Category: <strong>${type}</strong></div>
        <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Recommendation: Use local tool / web search to save ~0.3g CO₂</div>
      `;
      return;
    }

    // Try sending to background service worker for ML classification
    chrome.runtime.sendMessage({ type: 'CLASSIFY_PROMPT', text }, (res) => {
      if (chrome.runtime.lastError || !res) {
        testResult.innerHTML = `
          <div style="color: #f87171; font-weight: 700;">⚠️ Model Offline / Idle</div>
          <div style="margin-top: 2px;">Download AI Engine below to enable deep classification.</div>
        `;
        return;
      }

      if (res.intercept) {
        const scorePct = Math.round((res.score || 0.85) * 100);
        testResult.innerHTML = `
          <div style="color: #34d399; font-weight: 700;">🛡️ INTERCEPT (${scorePct}% Match)</div>
          <div style="margin-top: 2px;">Detected: <strong>${res.label || 'Simple Query'}</strong></div>
          <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Passes threshold (${res.threshold || 0.45}) → Intercepted</div>
        `;
      } else {
        testResult.innerHTML = `
          <div style="color: #38bdf8; font-weight: 700;">🚀 ALLOW (Passes to AI)</div>
          <div style="margin-top: 2px;">Reason: Complex generation / reasoning required.</div>
        `;
      }
    });
  }

  testBtn.onclick = runTestClassification;
  testInput.onkeydown = (e) => {
    if (e.key === 'Enter') runTestClassification();
  };

  // Toggle Handlers
  toggleShield.onchange = () => {
    const val = toggleShield.checked;
    chrome.storage.local.set({ ecoPromptEnabled: val });
    updateShieldStatusBadge(val);
  };

  toggleMl.onchange = () => {
    chrome.storage.local.set({ mlClassificationEnabled: toggleMl.checked });
  };
  
  toggleChatgpt.onchange = () => {
    chrome.storage.local.set({ enableChatgpt: toggleChatgpt.checked });
    syncPlatformChipUI();
  };
  
  toggleClaude.onchange = () => {
    chrome.storage.local.set({ enableClaude: toggleClaude.checked });
    syncPlatformChipUI();
  };
  
  toggleGemini.onchange = () => {
    chrome.storage.local.set({ enableGemini: toggleGemini.checked });
    syncPlatformChipUI();
  };

  sensitivitySlider.oninput = () => {
    const val = parseFloat(sensitivitySlider.value);
    sensitivityDisplay.innerText = val.toFixed(2);
    chrome.storage.local.set({ sensitivityThreshold: val });
  };

  // Download AI Engine Button
  modelDownloadBtn.onclick = () => {
    modelDownloadBtn.disabled = true;
    modelDownloadBtn.innerText = 'Initializing WASM...';

    chrome.runtime.sendMessage({ type: 'TRIGGER_DOWNLOAD' }, (res) => {
      if (res && !res.success) {
        console.error('Download trigger failed:', res.error);
        updateModelUI('error', 0);
      }
    });
  };

  // Reset Stats Button
  resetStatsBtn.onclick = () => {
    if (confirm('Reset your EcoPrompt impact statistics?')) {
      chrome.storage.local.set({
        queriesDiverted: 0,
        tokensSaved: 0,
        co2Saved: 0.0
      }, () => {
        statsDiverted.innerText = '0';
        statsTokens.innerText = '0';
        statsCo2.innerText = '0.00';
        updateEcoEquivalents(0);
      });
    }
  };

  // Model UI Sync Helper
  function updateModelUI(status: string, progress: number) {
    modelBadge.className = 'badge-status';
    
    if (status === 'ready') {
      modelBadge.innerText = 'Ready';
      modelBadge.classList.add('badge-ready');
      modelDetails.innerText = 'AI Engine is running locally on WASM.';
      modelProgressContainer.style.display = 'none';
      modelDownloadBtn.style.display = 'none';
    } 
    else if (status === 'downloading') {
      modelBadge.innerText = `Downloading ${progress}%`;
      modelBadge.classList.add('badge-downloading');
      modelDetails.innerText = 'Downloading local neural model weights...';
      modelProgressContainer.style.display = 'block';
      modelProgressBar.style.width = `${progress}%`;
      modelDownloadBtn.style.display = 'block';
      modelDownloadBtn.disabled = true;
      modelDownloadBtn.innerText = 'Downloading...';
    } 
    else if (status === 'error') {
      modelBadge.innerText = 'Error';
      modelBadge.classList.add('badge-error');
      modelDetails.innerText = 'Could not load weights. Check network connection.';
      modelProgressContainer.style.display = 'none';
      modelDownloadBtn.style.display = 'block';
      modelDownloadBtn.disabled = false;
      modelDownloadBtn.innerText = 'Try Again';
    } 
    else { // idle
      modelBadge.innerText = 'Idle';
      modelBadge.classList.add('badge-idle');
      modelDetails.innerText = 'Regex heuristics active. Download local AI model for zero-shot classification.';
      modelProgressContainer.style.display = 'none';
      modelDownloadBtn.style.display = 'block';
      modelDownloadBtn.disabled = false;
      modelDownloadBtn.innerText = 'Download AI Engine (22MB)';
    }
  }
});
