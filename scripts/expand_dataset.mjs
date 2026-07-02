import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASET_PATH = path.join(__dirname, '../src/assets/dataset.json');

const templates = {
  math: [
    "what is {n1} + {n2}",
    "calculate {n1} minus {n2}",
    "{n1} * {n2}",
    "{n1} / {n2}",
    "what is {n1} percent of {n2}",
    "square root of {n1}",
    "{n1} squared"
  ],
  conversion: [
    "convert {n1} miles to kilometers",
    "{n1} cm to inches",
    "how many pounds in {n1} kg",
    "{n1} fahrenheit to celsius",
    "convert {n1} usd to eur",
    "how many ounces in {n1} cups"
  ],
  trivia: [
    "capital of {country}",
    "who is the president of {country}",
    "population of {country}",
    "where is {country} located",
    "what is the tallest mountain in {country}"
  ],
  language: [
    "translate {word} to {lang}",
    "how to say {word} in {lang}",
    "define {word}",
    "synonym for {word}",
    "how do you spell {word}",
    "what does {word} mean"
  ],
  quick: [
    "weather in {city} today",
    "current time in {city}",
    "stock price of {company}",
    "how old is {celebrity}",
    "distance to {place}"
  ],
  // New Categories added from user feedback
  live_data: [
    "Live score of the {team1} vs {team2} match",
    "Current stock price of {company}",
    "Weather radar map for {city} right now",
    "Is {highway} traffic blocked due to accidents?",
    "Breaking news on the {city} earthquake"
  ],
  navigational: [
    "{company} customer portal login",
    "Download {software} official site",
    "{company} forgot password page",
    "IRS Form {formNumber} PDF",
    "GitHub repository for {software}"
  ],
  local_proximity: [
    "Emergency plumbers near me open now",
    "Directions to the nearest {store}",
    "Menu for {restaurant} on 5th Street",
    "Movie showtimes for {movie} tonight in my area",
    "Which {service} are in-network for {insurance} near me?"
  ],
  shopping_inventory: [
    "Cheapest direct flights from {airport1} to {airport2} next Tuesday",
    "Is the {product} in stock at {store}?",
    "{store} deals of the day under $50",
    "Compare prices for {product}",
    "Track {courier} package {trackingNumber}"
  ],
  primary_sources: [
    "Official text of the {lawDocument}",
    "CDC guidelines for {healthCondition}",
    "State of {state} tenant rights handbook",
    "Recent Supreme Court rulings on {legalTopic}",
    "Financial statements for {company} Q3 2025"
  ],
  human_experience: [
    "Reddit reviews for the new {product}",
    "Hacker News discussion on the latest {company} event",
    "TripAdvisor photos of the {hotel}",
    "Stack Overflow thread for {software} error 404",
    "Unboxing video for the {product}"
  ]
};

const data = {
  n1: [2, 5, 10, 15, 20, 50, 100, 250, 500, 1000],
  n2: [3, 4, 8, 12, 25, 40, 60, 80, 120, 300],
  country: ["france", "germany", "japan", "brazil", "canada", "australia", "india", "china", "italy", "spain", "mexico", "russia"],
  lang: ["spanish", "french", "german", "japanese", "chinese", "italian", "portuguese"],
  word: ["happy", "sad", "beautiful", "restaurant", "hello", "goodbye", "thank you", "love", "peace", "serendipity", "ubiquitous"],
  city: ["new york", "london", "tokyo", "paris", "sydney", "berlin", "mumbai", "toronto", "chicago"],
  company: ["apple", "google", "microsoft", "tesla", "amazon", "bank of america", "netflix"],
  celebrity: ["tom cruise", "taylor swift", "elon musk", "brad pitt", "beyonce"],
  place: ["the moon", "mars", "the sun", "london", "new york", "paris"],
  team1: ["india", "yankees", "lakers", "arsenal", "real madrid"],
  team2: ["australia", "red sox", "celtics", "chelsea", "barcelona"],
  highway: ["I-95 South", "I-405", "Route 66", "M25"],
  software: ["VLC media player", "React", "Python", "Docker", "Node.js"],
  formNumber: ["1040", "W-2", "1099", "I-9"],
  store: ["Best Buy", "Walmart", "gas station", "grocery store", "Target"],
  restaurant: ["Mario's Italian Restaurant", "Joe's Pizza", "Sushi Nakazawa"],
  movie: ["Dune 2", "Oppenheimer", "Barbie", "Spider-Man"],
  service: ["pharmacies", "dentists", "urgent care", "hospitals"],
  insurance: ["BlueCross", "Aetna", "Cigna", "UnitedHealthcare"],
  airport1: ["JFK", "LAX", "ORD"],
  airport2: ["LHR", "CDG", "HND"],
  product: ["PlayStation 5", "Samsung Galaxy S24 Ultra", "Dyson vacuum", "DJI Mini 4 Pro"],
  courier: ["FedEx", "UPS", "USPS", "DHL"],
  trackingNumber: ["123456789", "987654321", "1Z9999999999999999"],
  lawDocument: ["Digital Markets Act", "GDPR", "Clean Air Act"],
  healthCondition: ["food poisoning", "covid-19", "flu", "allergies"],
  state: ["California", "New York", "Texas", "Florida"],
  legalTopic: ["copyright", "free speech", "patent law"],
  hotel: ["Hilton Cancun", "Marriott Maui", "Four Seasons Paris"]
};

const dataset = new Set();

function generate() {
  // Existing loops
  for (const t of templates.math) {
    for (const n1 of data.n1) {
      for (const n2 of data.n2.slice(0, 3)) dataset.add(t.replace("{n1}", n1).replace("{n2}", n2));
    }
  }
  for (const t of templates.conversion) {
    for (const n1 of data.n1) dataset.add(t.replace("{n1}", n1));
  }
  for (const t of templates.trivia) {
    for (const c of data.country) dataset.add(t.replace("{country}", c));
  }
  for (const t of templates.language) {
    for (const w of data.word) {
      if (t.includes("{lang}")) {
        for (const l of data.lang.slice(0, 3)) dataset.add(t.replace("{word}", w).replace("{lang}", l));
      } else {
        dataset.add(t.replace("{word}", w));
      }
    }
  }
  for (const t of templates.quick) {
    if (t.includes("{city}")) for (const c of data.city) dataset.add(t.replace("{city}", c));
    else if (t.includes("{company}")) for (const c of data.company) dataset.add(t.replace("{company}", c));
    else if (t.includes("{celebrity}")) for (const c of data.celebrity) dataset.add(t.replace("{celebrity}", c));
    else if (t.includes("{place}")) for (const c of data.place) dataset.add(t.replace("{place}", c));
  }

  // Helper to replace multiple placeholders in a string
  const applyData = (template, replacements) => {
    let res = template;
    for (const [key, val] of Object.entries(replacements)) {
      res = res.replace(new RegExp(`{${key}}`, 'g'), val);
    }
    return res;
  };

  // Helper to process arrays of templates with dynamic variables
  const processTemplates = (templateArray, variablesToLoop) => {
    for (const t of templateArray) {
      // Find all placeholders in this template
      const placeholders = [...t.matchAll(/{(\w+)}/g)].map(m => m[1]);
      
      // We will do a basic combination. To avoid blowing up, if there are multiple placeholders,
      // we take a cross product but limit to a small subset.
      if (placeholders.length === 1) {
        const p = placeholders[0];
        for (const val of (data[p] || [])) {
          dataset.add(applyData(t, { [p]: val }));
        }
      } else if (placeholders.length === 2) {
        const p1 = placeholders[0];
        const p2 = placeholders[1];
        for (const v1 of (data[p1] || []).slice(0, 3)) {
          for (const v2 of (data[p2] || []).slice(0, 3)) {
            dataset.add(applyData(t, { [p1]: v1, [p2]: v2 }));
          }
        }
      } else {
        dataset.add(t); // No placeholders or too complex, just add the template
      }
    }
  };

  processTemplates(templates.live_data);
  processTemplates(templates.navigational);
  processTemplates(templates.local_proximity);
  processTemplates(templates.shopping_inventory);
  processTemplates(templates.primary_sources);
  processTemplates(templates.human_experience);

  // Add some specific edge cases
  const edgeCases = [
    "who wrote romeo and juliet",
    "when did ww2 end",
    "what is the fastest land animal",
    "how many planets in the solar system",
    "is a tomato a fruit or a vegetable",
    "who painted the mona lisa"
  ];
  edgeCases.forEach(e => dataset.add(e));
}

generate();

const result = Array.from(dataset);
console.log(`Generated ${result.length} prompts.`);
fs.writeFileSync(DATASET_PATH, JSON.stringify(result, null, 2));
console.log(`Saved to ${DATASET_PATH}`);
