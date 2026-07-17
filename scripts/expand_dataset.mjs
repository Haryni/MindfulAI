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
  ],
  // New Categories for Easily Surfed internet queries
  easily_surfed: [
    "how to {action} {item}",
    "top 10 {topCategory} in {year}",
    "lyrics for {song} by {artist}",
    "what is the cast of {movie}",
    "when is {holiday} {year}",
    "best {food} recipe",
    "how long to cook {food}",
    "who won the {sports_event} in {year}",
    "specs for {product}",
    "is {movie} streaming on Netflix",
    "how to fix {product} error",
    "what is the weather like in {city} next week",
    "difference between {product} and {product}",
    "what is the latest episode of {movie}",
    "who is the author of {book}"
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
  movie: ["Dune 2", "Oppenheimer", "Barbie", "Spider-Man", "The Matrix", "Inception"],
  service: ["pharmacies", "dentists", "urgent care", "hospitals"],
  insurance: ["BlueCross", "Aetna", "Cigna", "UnitedHealthcare"],
  airport1: ["JFK", "LAX", "ORD"],
  airport2: ["LHR", "CDG", "HND"],
  product: ["PlayStation 5", "Samsung Galaxy S24 Ultra", "Dyson vacuum", "DJI Mini 4 Pro", "MacBook Pro"],
  courier: ["FedEx", "UPS", "USPS", "DHL"],
  trackingNumber: ["123456789", "987654321", "1Z9999999999999999"],
  lawDocument: ["Digital Markets Act", "GDPR", "Clean Air Act"],
  healthCondition: ["food poisoning", "covid-19", "flu", "allergies"],
  state: ["California", "New York", "Texas", "Florida"],
  legalTopic: ["copyright", "free speech", "patent law"],
  hotel: ["Hilton Cancun", "Marriott Maui", "Four Seasons Paris"],
  // Easily surfed variables
  action: ["tie", "boil", "screenshot on", "clean", "reset"],
  item: ["a tie", "an egg", "mac", "a washing machine", "iphone"],
  topCategory: ["movies", "songs", "books", "games"],
  year: ["2023", "2024", "1999", "2010"],
  song: ["Bohemian Rhapsody", "Shape of You", "Hotel California", "Imagine"],
  artist: ["Queen", "Ed Sheeran", "Eagles", "John Lennon"],
  holiday: ["Thanksgiving", "Easter", "Halloween", "Mother's Day"],
  food: ["lasagna", "chocolate chip cookies", "steak", "chicken breast", "spaghetti", "pizza"],
  sports_event: ["Super Bowl", "World Cup", "World Series", "Wimbledon", "Olympics"],
  book: ["Harry Potter", "The Hobbit", "1984", "To Kill a Mockingbird", "Pride and Prejudice"]
};

const dataset = new Set();

function generate() {
  // Helper to replace multiple placeholders in a string
  const applyData = (template, replacements) => {
    let res = template;
    for (const [key, val] of Object.entries(replacements)) {
      res = res.replace(new RegExp(`{${key}}`, 'g'), val);
    }
    return res;
  };

  // Helper to process arrays of templates with dynamic variables
  const processTemplates = (templateArray) => {
    for (const t of templateArray) {
      const placeholders = [...t.matchAll(/{(\w+)}/g)].map(m => m[1]);
      
      if (placeholders.length === 1) {
        const p = placeholders[0];
        for (const val of (data[p] || [])) {
          dataset.add(applyData(t, { [p]: val }));
        }
      } else if (placeholders.length === 2) {
        const p1 = placeholders[0];
        const p2 = placeholders[1];
        // Use all elements to increase dataset size and model effectiveness
        for (const v1 of (data[p1] || [])) {
          for (const v2 of (data[p2] || [])) {
            dataset.add(applyData(t, { [p1]: v1, [p2]: v2 }));
          }
        }
      } else {
        dataset.add(t); // No placeholders or too complex, just add the template
      }
    }
  };

  processTemplates(templates.math);
  processTemplates(templates.conversion);
  processTemplates(templates.trivia);
  processTemplates(templates.language);
  processTemplates(templates.quick);
  processTemplates(templates.live_data);
  processTemplates(templates.navigational);
  processTemplates(templates.local_proximity);
  processTemplates(templates.shopping_inventory);
  processTemplates(templates.primary_sources);
  processTemplates(templates.human_experience);
  processTemplates(templates.easily_surfed);

  // Add some specific edge cases
  const edgeCases = [
    "who wrote romeo and juliet",
    "when did ww2 end",
    "what is the fastest land animal",
    "how many planets in the solar system",
    "is a tomato a fruit or a vegetable",
    "who painted the mona lisa",
    "what time is the sunset today",
    "how many calories in an apple",
    "what channel is the news on",
    "how to reset wifi router",
    "what to do if my sink is clogged",
    "why is the sky blue",
    "how to boil an egg",
    "when is the next leap year",
    "what is the capital of the US",
    "how to tie a tie",
    "how many feet in a mile",
    "is water wet",
    "what is the meaning of life"
  ];
  edgeCases.forEach(e => dataset.add(e));
}

generate();

const result = Array.from(dataset);
console.log(`Generated ${result.length} prompts.`);
fs.writeFileSync(DATASET_PATH, JSON.stringify(result, null, 2));
console.log(`Saved to ${DATASET_PATH}`);
