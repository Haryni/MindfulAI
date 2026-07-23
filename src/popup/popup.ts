// EcoPrompt Popup Controller

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statsDiverted = document.getElementById('stats-diverted')!;
  const statsTokens = document.getElementById('stats-tokens')!;
  const statsCo2 = document.getElementById('stats-co2')!;
  
  const equivBulb = document.getElementById('equiv-bulb')!;
  const equivKm = document.getElementById('equiv-km')!;
  const equivTrees = document.getElementById('equiv-trees')!;

  const searchInput = document.getElementById('popup-web-search-input') as HTMLInputElement;
  const ecosiaBtn = document.getElementById('popup-search-ecosia-btn') as HTMLButtonElement;

  function updateEcoEquivalents(co2Grams: number, diverted: number) {
    // ~10g CO2 per LED bulb hour -> co2 / 10
    const bulbHours = (co2Grams / 10).toFixed(1);
    // ~120g CO2 per km driven -> co2 / 120
    const kmDriven = (co2Grams / 120).toFixed(3);
    // ~60g CO2 absorbed by tree per day -> co2 / 60
    const trees = (co2Grams / 60).toFixed(2);

    equivBulb.innerText = bulbHours;
    equivKm.innerText = kmDriven;
    equivTrees.innerText = trees;
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
    statsCo2.innerText = String(co2.toFixed(2));
    updateEcoEquivalents(co2, diverted);

    // Controls
    toggleShield.checked = res.ecoPromptEnabled !== false; // default true
    toggleMl.checked = res.mlClassificationEnabled !== false; // default true
    
    toggleChatgpt.checked = res.enableChatgpt !== false;
    toggleClaude.checked = res.enableClaude !== false;
    toggleGemini.checked = res.enableGemini !== false;
    
    const sensitivity = res.sensitivityThreshold !== undefined ? res.sensitivityThreshold : 0.45;
    sensitivitySlider.value = String(sensitivity);
    sensitivityDisplay.innerText = Number(sensitivity).toFixed(2);

    // Model status
    updateModelUI(res.modelStatus || 'idle', res.modelProgress || 0);
  });

  // Watch for live storage changes (e.g. from background model downloads or content scripts)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.queriesDiverted || changes.co2Saved) {
      chrome.storage.local.get(['queriesDiverted', 'co2Saved'], (r) => {
        const div = r.queriesDiverted || 0;
        const c2 = r.co2Saved || 0.0;
        statsDiverted.innerText = String(div);
        statsCo2.innerText = String(c2.toFixed(2));
        updateEcoEquivalents(c2, div);
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

  // Quick Web Search handler
  function triggerEcosiaSearch() {
    const q = searchInput.value.trim();
    if (!q) return;
    chrome.tabs.create({ url: `https://www.ecosia.org/search?q=${encodeURIComponent(q)}` });
  }

  ecosiaBtn.onclick = triggerEcosiaSearch;
  searchInput.onkeydown = (e) => {
    if (e.key === 'Enter') triggerEcosiaSearch();
  };

  // Event Listeners for UI interaction
  toggleShield.onchange = () => {
    chrome.storage.local.set({ ecoPromptEnabled: toggleShield.checked });
  };

  toggleMl.onchange = () => {
    chrome.storage.local.set({ mlClassificationEnabled: toggleMl.checked });
  };
  
  toggleChatgpt.onchange = () => {
    chrome.storage.local.set({ enableChatgpt: toggleChatgpt.checked });
  };
  
  toggleClaude.onchange = () => {
    chrome.storage.local.set({ enableClaude: toggleClaude.checked });
  };
  
  toggleGemini.onchange = () => {
    chrome.storage.local.set({ enableGemini: toggleGemini.checked });
  };

  sensitivitySlider.oninput = () => {
    const val = parseFloat(sensitivitySlider.value);
    sensitivityDisplay.innerText = val.toFixed(2);
    chrome.storage.local.set({ sensitivityThreshold: val });
  };

  modelDownloadBtn.onclick = () => {
    // Disable button immediately to prevent double click
    modelDownloadBtn.disabled = true;
    modelDownloadBtn.innerText = 'Initializing...';

    // Call background service worker to trigger download
    chrome.runtime.sendMessage({ type: 'TRIGGER_DOWNLOAD' }, (res) => {
      if (res && !res.success) {
        console.error('Download trigger failed:', res.error);
        updateModelUI('error', 0);
      }
    });
  };

  // Helper to sync Model Interface UI state
  function updateModelUI(status: string, progress: number) {
    // Reset badges
    modelBadge.className = 'model-badge';
    
    if (status === 'ready') {
      modelBadge.innerText = 'Ready';
      modelBadge.classList.add('badge-ready');
      modelDetails.innerText = 'AI is ready and running locally on your device.';
      modelProgressContainer.style.display = 'none';
      modelDownloadBtn.style.display = 'none';
    } 
    
    else if (status === 'downloading') {
      modelBadge.innerText = `Downloading ${progress}%`;
      modelBadge.classList.add('badge-downloading');
      modelDetails.innerText = 'Downloading AI engine... (This happens only once)';
      modelProgressContainer.style.display = 'block';
      modelProgressBar.style.width = `${progress}%`;
      modelDownloadBtn.style.display = 'block';
      modelDownloadBtn.disabled = true;
      modelDownloadBtn.innerText = 'Downloading...';
    } 
    
    else if (status === 'error') {
      modelBadge.innerText = 'Error';
      modelBadge.classList.add('badge-error');
      modelDetails.innerText = 'Could not download the AI engine. Please check your internet.';
      modelProgressContainer.style.display = 'none';
      modelDownloadBtn.style.display = 'block';
      modelDownloadBtn.disabled = false;
      modelDownloadBtn.innerText = 'Try Again';
    } 
    
    else { // idle
      modelBadge.innerText = 'Not Ready';
      modelBadge.classList.add('badge-idle');
      modelDetails.innerText = 'Basic filtering is on. Download the AI engine for smarter filtering.';
      modelProgressContainer.style.display = 'none';
      modelDownloadBtn.style.display = 'block';
      modelDownloadBtn.disabled = false;
      modelDownloadBtn.innerText = 'Download AI Engine';
    }
  }
});
