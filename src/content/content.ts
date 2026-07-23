// EcoPrompt Content Interceptor Script
import './modal.css';

// Keep track of bypassed elements to prevent infinite interception loops
const bypassedElements = new WeakSet<HTMLElement>();

// Cache settings in content script memory for synchronous access
let settings = {
  ecoPromptEnabled: true,
  mlClassificationEnabled: true,
  sensitivityThreshold: 0.45,
  enableChatgpt: true,
  enableClaude: true,
  enableGemini: true,
};

// Initial settings load
chrome.storage.local.get(['ecoPromptEnabled', 'mlClassificationEnabled', 'sensitivityThreshold', 'enableChatgpt', 'enableClaude', 'enableGemini'], (res) => {
  if (res.ecoPromptEnabled !== undefined) settings.ecoPromptEnabled = res.ecoPromptEnabled;
  if (res.mlClassificationEnabled !== undefined) settings.mlClassificationEnabled = res.mlClassificationEnabled;
  if (res.sensitivityThreshold !== undefined) settings.sensitivityThreshold = res.sensitivityThreshold;
  if (res.enableChatgpt !== undefined) settings.enableChatgpt = res.enableChatgpt;
  if (res.enableClaude !== undefined) settings.enableClaude = res.enableClaude;
  if (res.enableGemini !== undefined) settings.enableGemini = res.enableGemini;
});

// Update settings when they change in storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.ecoPromptEnabled) settings.ecoPromptEnabled = changes.ecoPromptEnabled.newValue;
    if (changes.mlClassificationEnabled) settings.mlClassificationEnabled = changes.mlClassificationEnabled.newValue;
    if (changes.sensitivityThreshold) settings.sensitivityThreshold = changes.sensitivityThreshold.newValue;
    if (changes.enableChatgpt) settings.enableChatgpt = changes.enableChatgpt.newValue;
    if (changes.enableClaude) settings.enableClaude = changes.enableClaude.newValue;
    if (changes.enableGemini) settings.enableGemini = changes.enableGemini.newValue;
  }
});

// Detect current AI platform
const hostname = window.location.hostname;
let currentPlatform = '';
if (hostname.includes('chatgpt.com')) currentPlatform = 'chatgpt';
else if (hostname.includes('claude.ai')) currentPlatform = 'claude';
else if (hostname.includes('gemini.google.com')) currentPlatform = 'gemini';

function isCurrentPlatformEnabled(): boolean {
  if (currentPlatform === 'chatgpt') return settings.enableChatgpt;
  if (currentPlatform === 'claude') return settings.enableClaude;
  if (currentPlatform === 'gemini') return settings.enableGemini;
  return true; // Default to true for unknown platforms if they somehow get injected
}

// ===========================================================
// ROBUST ELEMENT DETECTION
// These selectors are ordered from most-specific to least-specific.
// Each major LLM has been accounted for.
// ===========================================================

const CHAT_INPUT_SELECTORS = [
  // ChatGPT
  '#prompt-textarea',
  'div[data-testid="prompt-textarea"]',
  // Claude
  '.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"].ProseMirror',
  // Gemini
  'div[contenteditable="true"][aria-label*="Enter a prompt" i]',
  'rich-textarea div[contenteditable="true"]',
  // Generic fallbacks
  'div[contenteditable="true"][aria-label*="message" i]',
  'div[contenteditable="true"][aria-label*="prompt" i]',
  'div[contenteditable="true"][aria-multiline="true"]',
  'textarea[data-id="root"]',
  'textarea[placeholder*="message" i]',
  'textarea[placeholder*="prompt" i]',
  'textarea[placeholder*="Ask" i]',
];

const SUBMIT_BUTTON_SELECTORS = [
  // ChatGPT specific
  'button[data-testid="send-button"]',
  'button[data-testid="fruitjuice-send-button"]',
  // Claude specific
  'button[aria-label="Send Message"]',
  // Gemini specific
  'button[aria-label="Send message"]',
  'button.send-button',
  // Generic accessible buttons
  'button[aria-label*="send" i]',
  'button[aria-label*="submit" i]',
  'button[type="submit"]',
];

function findChatInput(): HTMLElement | null {
  // 1. Prefer the actively focused element if it is a valid input
  const active = document.activeElement as HTMLElement;
  if (active && isKnownChatInput(active)) return active;

  // 2. Try each known selector
  for (const sel of CHAT_INPUT_SELECTORS) {
    try {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el && isKnownChatInput(el)) return el;
    } catch (_) { /* ignore invalid selectors */ }
  }

  return null;
}

function isKnownChatInput(el: HTMLElement): boolean {
  if (!el || el.tagName === 'BODY') return false;

  // 1. Explicit ID match
  if (el.id === 'prompt-textarea') return true;

  // 2. data-testid match
  const testId = el.getAttribute('data-testid') || '';
  if (testId.includes('prompt') || testId.includes('message')) return true;

  // 3. contenteditable div that has meaningful content area role
  if (el.getAttribute('contenteditable') === 'true') {
    const role = el.getAttribute('role') || '';
    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    const isMultiLine = el.getAttribute('aria-multiline') === 'true';
    
    if (isMultiLine) return true;
    if (role === 'textbox') return true;
    if (label.includes('message') || label.includes('prompt') || label.includes('ask') || label.includes('enter a prompt')) return true;
    if (el.classList.contains('ProseMirror')) return true;
    // Last resort: if it's inside a form or has siblings that are buttons
    const parent = el.closest('form, [role="main"]');
    if (parent && parent.querySelector('button')) return true;
  }

  // 4. Textarea
  if (el.tagName === 'TEXTAREA') return true;

  return false;
}

function findSubmitButton(): HTMLButtonElement | null {
  for (const sel of SUBMIT_BUTTON_SELECTORS) {
    try {
      const el = document.querySelector(sel) as HTMLButtonElement | null;
      if (el) return el;
    } catch (_) { /* ignore */ }
  }
  return null;
}

// Extract text contents from input
function getInputText(el: HTMLElement): string {
  if (el.tagName === 'TEXTAREA') {
    return (el as HTMLTextAreaElement).value;
  }
  return el.innerText || el.textContent || '';
}

// ===========================================================
// SUBMISSION INTERCEPTION - Listens at the capturing phase
// so we get the event before the LLM's own handlers.
// ===========================================================

document.addEventListener('keydown', handleKeyDown, true);
document.addEventListener('click', handleClick, true);
document.addEventListener('pointerdown', handlePointerDown, true);

function handleKeyDown(e: KeyboardEvent) {
  if (!settings.ecoPromptEnabled || !isCurrentPlatformEnabled()) return;

  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

  const target = e.target as HTMLElement;
  if (!isKnownChatInput(target)) return;
  if (bypassedElements.has(target)) return;

  const text = getInputText(target).trim();
  if (!text) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  processPrompt(target, text);
}

function handlePointerDown(e: PointerEvent) {
  // pointerdown fires before click, giving us first crack at button presses
  if (!settings.ecoPromptEnabled || !isCurrentPlatformEnabled()) return;

  const target = e.target as HTMLElement;
  const button = target.closest('button') as HTMLButtonElement | null;
  if (!button) return;
  if (bypassedElements.has(button)) return;

  // Only intercept if this matches a known send button
  if (!isKnownSendButton(button)) return;

  const inputEl = findChatInput();
  if (!inputEl) return;

  const text = getInputText(inputEl).trim();
  if (!text) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  processPrompt(inputEl, text, button);
}

function handleClick(e: MouseEvent) {
  if (!settings.ecoPromptEnabled || !isCurrentPlatformEnabled()) return;

  const target = e.target as HTMLElement;
  const button = target.closest('button') as HTMLButtonElement | null;
  if (!button) return;
  if (bypassedElements.has(button)) return;

  if (!isKnownSendButton(button)) return;

  const inputEl = findChatInput();
  if (!inputEl) return;

  const text = getInputText(inputEl).trim();
  if (!text) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  processPrompt(inputEl, text, button);
}

function isKnownSendButton(btn: HTMLButtonElement): boolean {
  const testId = btn.getAttribute('data-testid') || '';
  if (testId.includes('send') || testId.includes('fruitjuice')) return true;

  const label = (btn.getAttribute('aria-label') || '').toLowerCase();
  if (label.includes('send')) return true;

  if (btn.getAttribute('type') === 'submit') return true;

  const cls = btn.className;
  if (cls.includes('send')) return true;

  return false;
}

// ===========================================================
// CORE INTERCEPTION LOGIC
// ===========================================================

function processPrompt(inputEl: HTMLElement, text: string, clickButton?: HTMLButtonElement) {
  // 1. Regex heuristic checks (instant, no ML needed)
  const regexResult = runRegexChecks(text);
  if (regexResult.matched) {
    showSpeedBump(inputEl, text, regexResult.category, regexResult.suggestedAction, clickButton);
    return;
  }

  // 2. ML Classification (if enabled and model ready)
  if (settings.mlClassificationEnabled) {
    showLoadingSpinner();

    chrome.runtime.sendMessage({ type: 'CLASSIFY_PROMPT', text }, (res) => {
      removeLoadingSpinner();

      if (chrome.runtime.lastError) {
        // Extension context invalidated, just resubmit
        resubmitPrompt(inputEl, clickButton || null);
        return;
      }

      if (res && res.intercept) {
        showSpeedBump(
          inputEl,
          text,
          'AI flagged this as a simple query',
          {
            type: 'search',
            url: `https://www.google.com/search?q=${encodeURIComponent(text)}`,
            label: 'Search Google instead'
          },
          clickButton
        );
      } else {
        resubmitPrompt(inputEl, clickButton || null);
      }
    });
  } else {
    resubmitPrompt(inputEl, clickButton || null);
  }
}

function resubmitPrompt(inputEl: HTMLElement, submitBtn: HTMLButtonElement | null) {
  bypassedElements.add(inputEl);
  if (submitBtn) bypassedElements.add(submitBtn);

  // Give the bypass a tick to register before dispatching
  setTimeout(() => {
    const btn = submitBtn || findSubmitButton();
    if (btn) {
      bypassedElements.add(btn);
      btn.click();
    } else {
      // Fallback: synthesize Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
        bubbles: true, cancelable: true
      });
      inputEl.dispatchEvent(enterEvent);
    }

    // Remove bypass flag after submission so the user can send next message
    setTimeout(() => {
      bypassedElements.delete(inputEl);
      if (submitBtn) bypassedElements.delete(submitBtn);
    }, 2000);
  }, 0);
}

// ===========================================================
// REGEX HEURISTIC ENGINE
// ===========================================================

interface SuggestedAction {
  type: 'math' | 'syntax' | 'conversion' | 'search' | 'websurf' | 'chitchat';
  url?: string;
  label?: string;
}

interface RegexCheckResult {
  matched: boolean;
  category: string;
  suggestedAction: SuggestedAction;
}

function runRegexChecks(text: string): RegexCheckResult {
  const trimmed = text.trim();

  // ── 0. CHITCHAT / ZERO-VALUE PROMPTS (Unwanted Prompts) ─────────────────────
  const chitchat = /^(?:hi|hello|hey|good morning|good evening|good afternoon|how are you|who are you|are you there|test|testing|sup|yo|hi there|hello there)[.!?]*$/i.test(trimmed);
  if (chitchat) {
    return {
      matched: true,
      category: 'Unwanted Chitchat / Filler Greeting',
      suggestedAction: {
        type: 'chitchat'
      }
    };
  }

  // ── 1. DIRECT WEB SURFING / NAVIGATION ──────────────────────────────────────
  const navQuery = /^(?:go to|open|visit|navigate to)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|youtube|github|gmail|reddit|twitter|amazon|facebook|wikipedia|netflix|chatgpt|google)/i.test(trimmed)
    || /^[a-zA-Z0-9.-]+\.(?:com|org|io|net|edu|gov|ai)$/i.test(trimmed);

  if (navQuery) {
    let site = trimmed.replace(/^(?:go to|open|visit|navigate to)\s+/i, '').trim();
    if (!site.startsWith('http')) {
      site = site.includes('.') ? `https://${site}` : `https://www.google.com/search?q=${encodeURIComponent(site)}`;
    }
    return {
      matched: true,
      category: 'Direct Web Surfing / Navigation',
      suggestedAction: {
        type: 'websurf',
        url: site,
        label: `Navigate Directly (${site.replace(/^https?:\/\//, '')})`
      }
    };
  }

  // ── 2. LIVE WEATHER / FORECAST ──────────────────────────────────────────────
  const weatherQuery = /^(?:weather|forecast|temperature|is it going to rain|will it rain|weather forecast)\b/i.test(trimmed);
  if (weatherQuery) {
    return {
      matched: true,
      category: 'Live Weather Forecast',
      suggestedAction: {
        type: 'websurf',
        url: `https://www.ecosia.org/search?q=${encodeURIComponent(trimmed)}`,
        label: '🌦️ Check Live Weather on Ecosia'
      }
    };
  }

  // ── 3. STOCK / FINANCIAL MARKETS ───────────────────────────────────────────
  const stockQuery = /^(?:stock price|stock|crypto price|share price|ticker)\b/i.test(trimmed) || /^[a-zA-Z0-9]{1,5}\s+stock$/i.test(trimmed);
  if (stockQuery) {
    return {
      matched: true,
      category: 'Live Stock & Financial Market Query',
      suggestedAction: {
        type: 'websurf',
        url: `https://finance.yahoo.com/lookup?s=${encodeURIComponent(trimmed)}`,
        label: '📈 Check Stock Market on Yahoo Finance'
      }
    };
  }

  // ── 4. LOCATION & MAPS ─────────────────────────────────────────────────────
  const locationQuery = /^(?:directions to|restaurants near me|nearest|gas station near me|pharmacy near me|map of)\b/i.test(trimmed);
  if (locationQuery) {
    return {
      matched: true,
      category: 'Local Map & Location Search',
      suggestedAction: {
        type: 'websurf',
        url: `https://www.google.com/maps/search/${encodeURIComponent(trimmed)}`,
        label: '📍 Search Location on Google Maps'
      }
    };
  }

  // ── 5. ARITHMETIC ──────────────────────────────────────────────────────────
  // Pure numeric expression: 5+2, 100/4, (3*8)-1 etc.
  const arithmetic = /^\s*[-+]?\(?\d+(?:\.\d+)?\)?\s*[\+\-\*\/]\s*\(?\d+(?:\.\d+)?\)?[\s\+\-\*\/\(\)\d.]*$/.test(trimmed);

  // "calculate / calc / compute 5 * 12"
  const calcPhrase = /^(?:calculate|calc|compute)\s+.+/i.test(trimmed);

  // Natural-language arithmetic: "add X and Y", "subtract X from Y",
  // "divide X by/and Y", "multiply X by/and Y"
  const nlMath = /^(?:add|plus|sum of)\s+[\d.,]+\s+(?:and|\+)\s+[\d.,]+/i.test(trimmed)
    || /^(?:subtract|minus|take away|deduct)\s+[\d.,]+\s+(?:from|and)\s+[\d.,]+/i.test(trimmed)
    || /^(?:divide|divid[e]?)\s+[\d.,]+\s+(?:by|and|with)\s+[\d.,]+/i.test(trimmed)
    || /^(?:multiply|times)\s+[\d.,]+\s+(?:by|and|with)\s+[\d.,]+/i.test(trimmed)
    || /^(?:what is|what's)\s+[\d.,]+\s*[\+\-\*\/x÷]\s*[\d.,]+/i.test(trimmed)
    || /^(?:what is|what's)\s+(?:half|double|triple|square|cube)\s+of\s+[\d.,]+/i.test(trimmed)
    || /^(?:square root|sqrt|cube root)\s+of\s+[\d.,]+/i.test(trimmed)
    || /^(?:\d+)\s+(?:percent|%)\s+of\s+(?:\d+)/i.test(trimmed);

  if (arithmetic || calcPhrase || nlMath) {
    return {
      matched: true,
      category: 'Arithmetic Math Problem',
      suggestedAction: { type: 'math' }
    };
  }

  // ── 6. DICTIONARY / WORD DEFINITION ────────────────────────────────────────
  const dictQuery = /^(?:meaning of|define|definition of|what does .+ mean|what is the meaning of|synonym(?:s)? (?:of|for)|antonym(?:s)? (?:of|for)|what is a |what are |explain the (?:word|term))\s+\S+/i.test(trimmed);

  if (dictQuery) {
    const word = trimmed.replace(/^(?:meaning of|define|definition of|what does|what is the meaning of|synonym[s]? (?:of|for)|antonym[s]? (?:of|for)|what is a|what are|explain the (?:word|term))\s+/i, '').replace(/\s+mean\??$/, '').trim();
    return {
      matched: true,
      category: 'Word Definition / Meaning',
      suggestedAction: {
        type: 'search',
        url: `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`,
        label: 'Merriam-Webster Dictionary'
      }
    };
  }

  // ── 7. SIMPLE FACTUAL LOOKUP (Wikipedia) ───────────────────────────────────
  const wikiQuery = /^(?:who is|who was|what is|what was|tell me about|who are|where is|where was|when (?:did|was|is)|why (?:did|is|was))\s+.{3,60}$/i.test(trimmed)
    && trimmed.split(' ').length <= 10; // short factual questions only

  if (wikiQuery) {
    const q = trimmed.replace(/^(?:who is|who was|what is|what was|tell me about|who are|where is|where was|when (?:did|was|is)|why (?:did|is|was))\s+/i, '').trim();
    return {
      matched: true,
      category: 'Simple Factual Lookup',
      suggestedAction: {
        type: 'search',
        url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
        label: 'Search Wikipedia'
      }
    };
  }

  // ── 8. CODING SYNTAX REFERENCE ─────────────────────────────────────────────
  const syntaxQuery = /^(?:what is the syntax (?:for|of)|how (?:do|to) (?:I )?write(?: a)?|syntax of)\s+.+(?:loop|function|class|method|interface|struct|conditional|if.statement|for.loop|while.loop|switch)/i.test(trimmed);
  const langSyntax = /^(?:javascript|python|typescript|css|html|rust|go|c\+\+|java|ruby|swift|kotlin|php)\s+(?:syntax|how to)/i.test(trimmed);

  if (syntaxQuery || langSyntax) {
    const query = encodeURIComponent(trimmed);
    return {
      matched: true,
      category: 'Coding Syntax Reference',
      suggestedAction: {
        type: 'syntax',
        url: `https://developer.mozilla.org/en-US/search?q=${query}`,
        label: 'Search MDN Web Docs'
      }
    };
  }

  // ── 9. UNIT / FORMAT CONVERSION ────────────────────────────────────────────
  const conversion = /^(?:convert|change|how (?:many|much))\s+.+(?:\s+to\s+|\s+in\s+|\s+into\s+).+/i.test(trimmed);
  if (conversion) {
    return {
      matched: true,
      category: 'Unit or Format Conversion',
      suggestedAction: { type: 'conversion' }
    };
  }

  return { matched: false, category: '', suggestedAction: { type: 'search' } };
}

// ===========================================================
// LOADING SPINNER
// ===========================================================

function showLoadingSpinner() {
  removeLoadingSpinner();
  const spinner = document.createElement('div');
  spinner.id = 'eco-prompt-spinner-overlay';
  spinner.className = 'eco-prompt-overlay';
  spinner.innerHTML = `
    <div class="eco-prompt-modal" style="align-items: center; max-width: 320px; padding: 22px; gap: 12px;">
      <div style="font-size: 36px; animation: ecoSpin 1.2s linear infinite; line-height: 1;">🍃</div>
      <div style="font-weight: 600; font-size: 15px; color: #f1f5f9;">EcoPrompt is checking...</div>
      <div style="font-size: 12px; color: #94a3b8;">Running client-side AI</div>
    </div>
  `;
  document.body.appendChild(spinner);
}

function removeLoadingSpinner() {
  document.getElementById('eco-prompt-spinner-overlay')?.remove();
}

// ===========================================================
// SPEEDBUMP MODAL
// ===========================================================

function showSpeedBump(
  inputEl: HTMLElement,
  text: string,
  category: string,
  action: SuggestedAction,
  clickButton?: HTMLButtonElement
) {
  closeSpeedBump();

  const overlay = document.createElement('div');
  overlay.id = 'eco-prompt-modal-overlay';
  overlay.className = 'eco-prompt-overlay';

  const preview = text.length > 160 ? text.substring(0, 160) + '...' : text;

  overlay.innerHTML = `
    <div class="eco-prompt-modal">
      <div class="eco-prompt-header">
        <div class="eco-prompt-icon-container">🍃</div>
        <div>
          <h3 class="eco-prompt-title">EcoPrompt Shield</h3>
          <div class="eco-prompt-subtitle">Mindful Compute &amp; Carbon Protection</div>
        </div>
      </div>
      <p class="eco-prompt-body">
        This looks like a <span class="eco-prompt-highlight">${category}</span>. Save compute &amp; carbon by browsing the web or using a local tool instead!
      </p>
      <div class="eco-prompt-preview">${escapeHtml(preview)}</div>
      
      <!-- Carbon Savings Meter Card -->
      <div class="eco-prompt-carbon-card">
        <div class="eco-prompt-carbon-header">
          <span class="eco-leaf-pulse">🌱</span>
          <span class="eco-prompt-carbon-title">Carbon Impact Comparison</span>
        </div>
        <div class="eco-prompt-carbon-body">
          Web search uses <strong>&lt; 0.003g CO₂</strong> vs <strong>~0.30g CO₂</strong> for an AI LLM query (<strong>99% energy saved</strong>).
        </div>
      </div>

      <div class="eco-prompt-actions" id="eco-prompt-actions-container"></div>
      <button class="eco-prompt-btn-bypass" id="eco-prompt-bypass-btn">Ignore shield and ask AI anyway →</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const container = document.getElementById('eco-prompt-actions-container')!;
  buildActions(container, action, text);

  document.getElementById('eco-prompt-bypass-btn')!.onclick = () => {
    closeSpeedBump();
    resubmitPrompt(inputEl, clickButton || null);
  };

  // Click outside the card closes modal and lets prompt through
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeSpeedBump();
      resubmitPrompt(inputEl, clickButton || null);
    }
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildActions(container: HTMLElement, action: { type: string; url?: string; label?: string }, text: string) {
  if (action.type === 'chitchat') {
    const ecoBtn = document.createElement('button');
    ecoBtn.className = 'eco-prompt-btn-primary';
    ecoBtn.innerHTML = '🌲 Surf Web with Ecosia (Plant Trees)';
    ecoBtn.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(`https://www.ecosia.org/search?q=${encodeURIComponent(text)}`, '_blank');
      closeSpeedBump();
    };
    container.appendChild(ecoBtn);

    const ddgBtn = document.createElement('button');
    ddgBtn.className = 'eco-prompt-btn-secondary';
    ddgBtn.innerHTML = '🦆 Search DuckDuckGo';
    ddgBtn.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(`https://duckduckgo.com/?q=${encodeURIComponent(text)}`, '_blank');
      closeSpeedBump();
    };
    container.appendChild(ddgBtn);
  }

  else if (action.type === 'websurf') {
    if (action.url && action.label) {
      const directBtn = document.createElement('button');
      directBtn.className = 'eco-prompt-btn-primary';
      directBtn.innerHTML = action.label.startsWith('http') || action.label.includes('Navigate') 
        ? `🌐 ${action.label}` 
        : action.label;
      directBtn.onclick = () => {
        chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
        window.open(action.url!, '_blank');
        closeSpeedBump();
      };
      container.appendChild(directBtn);
    }

    const ecosiaBtn = document.createElement('button');
    ecosiaBtn.className = action.url ? 'eco-prompt-btn-secondary' : 'eco-prompt-btn-primary';
    ecosiaBtn.innerHTML = '🌲 Search with Ecosia (Eco Search)';
    ecosiaBtn.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(`https://www.ecosia.org/search?q=${encodeURIComponent(text)}`, '_blank');
      closeSpeedBump();
    };
    container.appendChild(ecosiaBtn);
  }

  else if (action.type === 'math') {
    const btn = document.createElement('button');
    btn.className = 'eco-prompt-btn-primary';
    btn.innerHTML = '🧮 Open Local Calculator';
    btn.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      openCalculator(text);
      closeSpeedBump();
    };
    container.appendChild(btn);

    const ecosia = document.createElement('button');
    ecosia.className = 'eco-prompt-btn-secondary';
    ecosia.innerHTML = '🌲 Search Ecosia Web Calculator';
    ecosia.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(`https://www.ecosia.org/search?q=${encodeURIComponent(text)}`, '_blank');
      closeSpeedBump();
    };
    container.appendChild(ecosia);
  }

  else if (action.type === 'syntax') {
    const mdn = document.createElement('button');
    mdn.className = 'eco-prompt-btn-primary';
    mdn.innerHTML = '🌐 Search MDN Web Docs';
    mdn.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(action.url!, '_blank');
      closeSpeedBump();
    };
    container.appendChild(mdn);

    const so = document.createElement('button');
    so.className = 'eco-prompt-btn-secondary';
    so.innerHTML = '💻 Search StackOverflow';
    so.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(`https://stackoverflow.com/search?q=${encodeURIComponent(text)}`, '_blank');
      closeSpeedBump();
    };
    container.appendChild(so);
  }

  else if (action.type === 'conversion') {
    const btn = document.createElement('button');
    btn.className = 'eco-prompt-btn-primary';
    btn.innerHTML = '🔄 Open Local Unit Converter';
    btn.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      openConverter(text);
      closeSpeedBump();
    };
    container.appendChild(btn);
  }

  else {
    // Default search - Offer Ecosia first (Eco-friendly search) then Google & DuckDuckGo
    const eco = document.createElement('button');
    eco.className = 'eco-prompt-btn-primary';
    eco.innerHTML = '🌲 Search Ecosia (Plants Trees)';
    eco.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(`https://www.ecosia.org/search?q=${encodeURIComponent(text)}`, '_blank');
      closeSpeedBump();
    };
    container.appendChild(eco);

    if (action.url && action.label) {
      const specific = document.createElement('button');
      specific.className = 'eco-prompt-btn-secondary';
      specific.innerHTML = `🔗 ${action.label}`;
      specific.onclick = () => {
        chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
        window.open(action.url!, '_blank');
        closeSpeedBump();
      };
      container.appendChild(specific);
    }

    const g = document.createElement('button');
    g.className = 'eco-prompt-btn-secondary';
    g.innerHTML = '🔍 Search Google';
    g.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank');
      closeSpeedBump();
    };
    container.appendChild(g);

    const ddg = document.createElement('button');
    ddg.className = 'eco-prompt-btn-secondary';
    ddg.innerHTML = '🦆 Search DuckDuckGo';
    ddg.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RECORD_DIVERSION', text });
      window.open(`https://duckduckgo.com/?q=${encodeURIComponent(text)}`, '_blank');
      closeSpeedBump();
    };
    container.appendChild(ddg);
  }
}


function closeSpeedBump() {
  document.getElementById('eco-prompt-modal-overlay')?.remove();
}

// ===========================================================
// DRAGGABLE WIDGET HELPERS
// ===========================================================

function makeElementDraggable(el: HTMLElement, handle: HTMLElement) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  handle.onmousedown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    e.preventDefault();
    pos3 = e.clientX; pos4 = e.clientY;
    document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
    document.onmousemove = (ev: MouseEvent) => {
      ev.preventDefault();
      pos1 = pos3 - ev.clientX; pos2 = pos4 - ev.clientY;
      pos3 = ev.clientX; pos4 = ev.clientY;
      el.style.top = (el.offsetTop - pos2) + 'px';
      el.style.left = (el.offsetLeft - pos1) + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    };
  };
}

function cleanMathExpression(expr: string): string {
  return expr.replace(/^(?:calculate|calc|what is|what's)\s+/i, '').replace(/[^0-9+\-*/.() ]/g, '').trim();
}

// ===========================================================
// CALCULATOR WIDGET
// ===========================================================

function openCalculator(initialExpression: string) {
  const existing = document.getElementById('eco-prompt-calc-widget');
  if (existing) {
    existing.style.display = 'block';
    const screen = document.getElementById('eco-calc-screen') as HTMLInputElement;
    if (screen) screen.value = cleanMathExpression(initialExpression);
    return;
  }

  const widget = document.createElement('div');
  widget.id = 'eco-prompt-calc-widget';
  widget.className = 'eco-prompt-widget';
  widget.style.cssText = 'top: 80px; right: 20px;';

  widget.innerHTML = `
    <div class="eco-prompt-widget-header" id="eco-calc-header">
      <div class="eco-prompt-widget-title">🧮 Local Calculator</div>
      <button class="eco-prompt-widget-close" id="eco-calc-close">×</button>
    </div>
    <div class="eco-prompt-widget-body">
      <input type="text" class="eco-calc-screen" id="eco-calc-screen" readonly value="${escapeHtml(cleanMathExpression(initialExpression))}">
      <div class="eco-calc-keys">
        <button class="eco-calc-btn eco-calc-btn-clear" data-val="C">C</button>
        <button class="eco-calc-btn eco-calc-btn-op" data-val="(">(</button>
        <button class="eco-calc-btn eco-calc-btn-op" data-val=")">)</button>
        <button class="eco-calc-btn eco-calc-btn-op" data-val="/">/</button>
        <button class="eco-calc-btn" data-val="7">7</button>
        <button class="eco-calc-btn" data-val="8">8</button>
        <button class="eco-calc-btn" data-val="9">9</button>
        <button class="eco-calc-btn eco-calc-btn-op" data-val="*">×</button>
        <button class="eco-calc-btn" data-val="4">4</button>
        <button class="eco-calc-btn" data-val="5">5</button>
        <button class="eco-calc-btn" data-val="6">6</button>
        <button class="eco-calc-btn eco-calc-btn-op" data-val="-">-</button>
        <button class="eco-calc-btn" data-val="1">1</button>
        <button class="eco-calc-btn" data-val="2">2</button>
        <button class="eco-calc-btn" data-val="3">3</button>
        <button class="eco-calc-btn eco-calc-btn-op" data-val="+">+</button>
        <button class="eco-calc-btn" data-val="0">0</button>
        <button class="eco-calc-btn" data-val=".">.</button>
        <button class="eco-calc-btn eco-calc-btn-eq" data-val="=" style="grid-column: span 2">=</button>
      </div>
    </div>
  `;

  document.body.appendChild(widget);
  makeElementDraggable(widget, document.getElementById('eco-calc-header')!);
  document.getElementById('eco-calc-close')!.onclick = () => widget.remove();

  const screen = document.getElementById('eco-calc-screen') as HTMLInputElement;
  widget.querySelectorAll('.eco-calc-btn').forEach(btn => {
    (btn as HTMLButtonElement).onclick = () => {
      const val = btn.getAttribute('data-val')!;
      if (val === 'C') {
        screen.value = '';
      } else if (val === '=') {
        try {
          // safe eval restricted to arithmetic
          const expr = screen.value.replace(/×/g, '*');
          const result = Function(`"use strict"; return (${expr})`)();
          screen.value = result !== undefined ? String(result) : '';
        } catch { screen.value = 'Error'; }
      } else {
        if (screen.value === 'Error') screen.value = '';
        screen.value += val === '×' ? '*' : val;
      }
    };
  });
}

// ===========================================================
// UNIT CONVERTER WIDGET
// ===========================================================

function openConverter(initialPrompt: string) {
  const existing = document.getElementById('eco-prompt-conv-widget');
  if (existing) { existing.style.display = 'block'; return; }

  const widget = document.createElement('div');
  widget.id = 'eco-prompt-conv-widget';
  widget.className = 'eco-prompt-widget';
  widget.style.cssText = 'top: 150px; right: 20px;';

  widget.innerHTML = `
    <div class="eco-prompt-widget-header" id="eco-conv-header">
      <div class="eco-prompt-widget-title">🔄 Unit Converter</div>
      <button class="eco-prompt-widget-close" id="eco-conv-close">×</button>
    </div>
    <div class="eco-prompt-widget-body">
      <div class="eco-conv-row">
        <label>Conversion Type</label>
        <select class="eco-conv-select" id="eco-conv-type">
          <option value="c2f">Celsius → Fahrenheit</option>
          <option value="f2c">Fahrenheit → Celsius</option>
          <option value="km2mi">Kilometers → Miles</option>
          <option value="mi2km">Miles → Kilometers</option>
          <option value="m2ft">Meters → Feet</option>
          <option value="ft2m">Feet → Meters</option>
          <option value="kg2lb">Kilograms → Pounds</option>
          <option value="lb2kg">Pounds → Kilograms</option>
          <option value="l2gal">Liters → Gallons (US)</option>
          <option value="gal2l">Gallons (US) → Liters</option>
        </select>
      </div>
      <div class="eco-conv-row">
        <label>Input Value</label>
        <input type="number" class="eco-conv-input" id="eco-conv-input" value="1">
      </div>
      <div class="eco-conv-row">
        <label>Result</label>
        <div class="eco-conv-result" id="eco-conv-result">—</div>
      </div>
    </div>
  `;

  document.body.appendChild(widget);
  makeElementDraggable(widget, document.getElementById('eco-conv-header')!);
  document.getElementById('eco-conv-close')!.onclick = () => widget.remove();

  const valInput = document.getElementById('eco-conv-input') as HTMLInputElement;
  const typeSelect = document.getElementById('eco-conv-type') as HTMLSelectElement;
  const resultDiv = document.getElementById('eco-conv-result')!;

  // Pre-populate based on prompt
  const parsed = parseConversionPrompt(initialPrompt);
  if (parsed) {
    valInput.value = String(parsed.value);
    typeSelect.value = parsed.type;
  }

  const CONVERSIONS: Record<string, (v: number) => string> = {
    c2f: (v) => `${((v * 9/5) + 32).toFixed(2)} °F`,
    f2c: (v) => `${((v - 32) * 5/9).toFixed(2)} °C`,
    km2mi: (v) => `${(v * 0.621371).toFixed(4)} mi`,
    mi2km: (v) => `${(v * 1.60934).toFixed(4)} km`,
    m2ft: (v) => `${(v * 3.28084).toFixed(4)} ft`,
    ft2m: (v) => `${(v / 3.28084).toFixed(4)} m`,
    kg2lb: (v) => `${(v * 2.20462).toFixed(4)} lb`,
    lb2kg: (v) => `${(v / 2.20462).toFixed(4)} kg`,
    l2gal: (v) => `${(v * 0.264172).toFixed(4)} gal`,
    gal2l: (v) => `${(v / 0.264172).toFixed(4)} L`,
  };

  function runConversion() {
    const val = parseFloat(valInput.value);
    if (isNaN(val)) { resultDiv.innerText = 'Invalid input'; return; }
    const fn = CONVERSIONS[typeSelect.value];
    resultDiv.innerText = fn ? fn(val) : '—';
  }

  valInput.oninput = runConversion;
  typeSelect.onchange = runConversion;
  runConversion();
}

function parseConversionPrompt(prompt: string): { value: number; type: string } | null {
  const m = prompt.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z°]+)\s+(?:to|into|in)\s+([a-zA-Z°]+)/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const from = m[2].toLowerCase();
  const to = m[3].toLowerCase();

  const map: [RegExp, RegExp, string][] = [
    [/^c/, /^f/, 'c2f'], [/^f/, /^c/, 'f2c'],
    [/^km/, /^mi/, 'km2mi'], [/^mi/, /^km/, 'mi2km'],
    [/^m/, /^ft|^f/, 'm2ft'], [/^ft|^f/, /^m$/, 'ft2m'],
    [/^kg/, /^lb|^po/, 'kg2lb'], [/^lb|^po/, /^kg/, 'lb2kg'],
    [/^l/, /^gal/, 'l2gal'], [/^gal/, /^l/, 'gal2l'],
  ];

  for (const [fr, tr, type] of map) {
    if (fr.test(from) && tr.test(to)) return { value, type };
  }
  return null;
}
