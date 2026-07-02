import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@huggingface/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_PATH = path.join(__dirname, '../src/assets/dataset.json');
const OUTPUT_PATH = path.join(__dirname, '../src/assets/embeddings.json');

async function generateEmbeddings() {
  console.log('Loading dataset...');
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));

  console.log(`Loaded ${dataset.length} prompts. Initializing model...`);
  
  // Use all-MiniLM-L6-v2 which is small and fast for semantic search
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    device: 'cpu' // Run on CPU for Node.js script compatibility
  });

  console.log('Model loaded. Computing embeddings...');
  
  const results = [];
  
  for (let i = 0; i < dataset.length; i++) {
    const text = dataset[i];
    // Generate embedding with mean pooling and L2 normalization
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    
    // The output data is a Float32Array, convert to normal array for JSON storage
    results.push({
      text: text,
      embedding: Array.from(output.data)
    });
    
    if ((i + 1) % 10 === 0) {
      console.log(`Processed ${i + 1}/${dataset.length}...`);
    }
  }

  console.log('Finished computing embeddings. Saving to file...');
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results));
  console.log(`Done! Embeddings saved to ${OUTPUT_PATH}`);
}

generateEmbeddings().catch(console.error);
