// EcoPrompt Popup Controller

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statsDiverted = document.getElementById('stats-diverted')!;
  const statsTokens = document.getElementById('stats-tokens')!;
  const statsCo2 = document.getElementById('stats-co2')!;
  
  const toggleShield = document.getElementById('toggle-shield') as HTMLInputElement;
  const toggleMl = document.getElementById('toggle-ml') as HTMLInputElement;
  
  const sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
  const sensitivityDisplay = document.getElementById('sensitivity-display')!;
  
  const modelBadge = document.getElementById('model-badge')!;
  const modelDetails = document.getElementById('model-details')!;
  const modelProgressContainer = document.getElementById('model-progress-container')!;
  const modelProgressBar = document.getElementById('model-progress-bar') as HTMLElement;
  const modelDownloadBtn = document.getElementById('model-download-btn') as HTMLButtonElement;

  // Load and display current values from storage
  chrome.storage.local.get([
    'ecoPromptEnabled',
    'mlClassificationEnabled',
    'sensitivityThreshold',
    'queriesDiverted',
    'tokensSaved',
    'co2Saved',
    'modelStatus',
    'modelProgress'
  ], (res) => {
    // Stats
    statsDiverted.innerText = String(res.queriesDiverted || 0);
    statsTokens.innerText = String(res.tokensSaved || 0);
    statsCo2.innerText = String((res.co2Saved || 0.0).toFixed(2));

    // Controls
    toggleShield.checked = res.ecoPromptEnabled !== false; // default true
    toggleMl.checked = res.mlClassificationEnabled !== false; // default true
    
    const sensitivity = res.sensitivityThreshold !== undefined ? res.sensitivityThreshold : 0.6;
    sensitivitySlider.value = String(sensitivity);
    sensitivityDisplay.innerText = Number(sensitivity).toFixed(2);

    // Model status
    updateModelUI(res.modelStatus || 'idle', res.modelProgress || 0);
  });

  // Watch for live storage changes (e.g. from background model downloads or content scripts)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.queriesDiverted) {
      statsDiverted.innerText = String(changes.queriesDiverted.newValue);
    }
    if (changes.tokensSaved) {
      statsTokens.innerText = String(changes.tokensSaved.newValue);
    }
    if (changes.co2Saved) {
      statsCo2.innerText = String((changes.co2Saved.newValue || 0.0).toFixed(2));
    }
    
    if (changes.modelStatus || changes.modelProgress) {
      const status = changes.modelStatus ? changes.modelStatus.newValue : undefined;
      const progress = changes.modelProgress ? changes.modelProgress.newValue : undefined;
      
      chrome.storage.local.get(['modelStatus', 'modelProgress'], (res) => {
        updateModelUI(status || res.modelStatus || 'idle', progress !== undefined ? progress : (res.modelProgress || 0));
      });
    }
  });

  // Event Listeners for UI interaction
  toggleShield.onchange = () => {
    chrome.storage.local.set({ ecoPromptEnabled: toggleShield.checked });
  };

  toggleMl.onchange = () => {
    chrome.storage.local.set({ mlClassificationEnabled: toggleMl.checked });
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
