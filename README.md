# 🌱 EcoPrompt (MindfulAI)

**EcoPrompt** is a mindful, privacy-first Chrome Extension designed to reduce unnecessary compute usage and carbon emissions. It acts as an intelligent shield for your generative AI prompts. 

Before your prompt reaches a power-hungry LLM, EcoPrompt uses lightweight, **client-side AI** to determine if your query could be easily resolved using traditional, low-compute methods (like a local calculator, standard web search, or live inventory trackers).

## ✨ Features

- 🛑 **Intelligent Interception:** Catches basic math, unit conversions, trivial facts, live data queries, and simple translations before they burn unnecessary GPU cycles.
- 🧠 **Dual AI Engine:**
  - **Zero-Shot Classification:** Uses `Xenova/nli-deberta-v3-xsmall` to categorize prompts based on reasoning complexity.
  - **Semantic Similarity Search:** Uses `Xenova/all-MiniLM-L6-v2` to instantly compare your prompt against a massive, pre-computed dataset of known "low-compute" queries.
- 🔒 **100% Local & Private:** All machine learning models run directly in your browser using Transformers.js. Your prompts are never sent to a remote server for classification.
- 📊 **Impact Tracking:** Tracks how many queries you've diverted, tokens you've saved, and grams of CO₂ emissions you've prevented.
- ⚡ **Lightning Fast:** Models are cached after the first download, and the RAG-style semantic search takes milliseconds.

## 🚀 How it Works

When you submit a prompt on supported generative AI platforms, EcoPrompt analyzes it. If it identifies the prompt as a "Simple Query", it triggers a non-intrusive SpeedBump UI suggesting a greener alternative (e.g., "Search DuckDuckGo" or "Open Local Calculator"). You always have the option to bypass the SpeedBump and ask the AI anyway.

## 🛠️ Tech Stack

- **Extension Framework:** Chrome Manifest V3
- **Build Tool:** Vite + TypeScript
- **Machine Learning:** Transformers.js (running WebAssembly)
- **Models:** 
  - Zero-shot classification (`nli-deberta-v3-xsmall`)
  - Feature extraction for embeddings (`all-MiniLM-L6-v2`)

## 📦 Setup & Installation

### 1. Build the Extension
Ensure you have Node.js installed, then run:

```bash
npm install
npm run build
```

This will create a `dist/` folder containing the compiled Chrome Extension.

### 2. Load into Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** in the top right corner.
3. Click **"Load unpacked"** and select the `dist/` directory generated in step 1.

## 🧪 Modifying the ML Dataset

EcoPrompt's semantic search uses a dataset of known simple queries to maintain extremely high accuracy. 

To add new categories or prompts:
1. Edit `scripts/expand_dataset.mjs` with your new templates or data.
2. Run `node scripts/expand_dataset.mjs` to generate the raw `dataset.json`.
3. Run `node scripts/generate_embeddings.mjs` to pre-compute the vector embeddings.
4. Rebuild the extension with `npm run build`.

---
*Built with ❤️ to make the web a little greener.*
