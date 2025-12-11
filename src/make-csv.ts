#!/usr/bin/env node

/**
 * Restaurant Address Lookup Tool
 * Correctly parses LA restaurant data and helps you find addresses
 */

import { readFile, writeFile } from "node:fs/promises";
import { stringify } from "csv-stringify/sync";

const NEIGHBORHOODS = new Set([
  "Koreatown",
  "North Hollywood",
  "San Gabriel Valley",
  "Artesia",
  "Boyle Heights",
  "Sherman Oaks",
  "Newport Beach",
  "Glendale",
  "Pasadena",
  "Temple City",
  "South Gate",
  "Little Ethiopia",
  "Garden Grove",
  "Northridge",
  "Pico-Union",
  "Westchester",
  "Hollywood",
  "View Park-Windsor Hills",
  "Hermosa Beach",
  "East Hollywood",
  "Cudahy",
  "Downtown L.A.",
  "Huntington Park",
  "West Los Angeles",
  "Hancock Park",
  "Santa Ana",
  "Atwater Village",
  "Beverly Hills",
  "Alhambra",
  "San Juan Capistrano",
  "Santa Monica",
  "Chinatown",
  "Hyde Park",
  "Studio City",
  "El Sereno",
  "Venice",
  "West Hollywood",
  "Los Feliz",
  "West Adams",
  "Long Beach",
  "Culver City",
  "Lincoln Heights",
  "Echo Park",
  "Pico-Robertson",
  "Costa Mesa",
  "Anaheim",
  "Torrance",
  "Inglewood",
  "Mid-Wilshire",
  "Silver Lake",
  "Palms",
  "Larchmont",
  "Glassell Park",
  "Historic South-Central",
  "Arleta",
]);

interface Restaurant {
  name: string;
  neighborhood: string;
  cuisine: string;
  price: string;
  address: string;
}

/**
 * Parse restaurant line: format is 'Name Neighborhood • Cuisine • Price' OR 'Name Description • Price'
 */
function parseLine(line: string): Restaurant {
  let parts = line.split("•").map((p) => p.trim());

  // Extract price (always last part with $)
  let price = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && part.includes("$")) {
      price = part;
      parts.splice(i, 1);
      break;
    }
  }

  // Now we have either ["Name Neighborhood", "Cuisine"] or ["Name Description"]
  const firstPart = parts[0] ?? "";
  const cuisine = parts.length > 1 ? parts[1] ?? "" : "";

  // Find neighborhood in first part
  let name = firstPart;
  let neighborhood = "";

  // Sort neighborhoods by length (longest first) to match correctly
  const sortedNeighborhoods = Array.from(NEIGHBORHOODS).sort(
    (a, b) => b.length - a.length
  );

  for (const hood of sortedNeighborhoods) {
    if (firstPart.includes(hood)) {
      // Find the neighborhood
      const idx = firstPart.lastIndexOf(hood);
      name = firstPart.substring(0, idx).trim();
      neighborhood = hood;
      break;
    }
  }

  // Validate required fields
  if (!neighborhood) {
    throw new Error(
      `Could not find neighborhood in line: "${line}"\nParsed: name="${name}", firstPart="${firstPart}"`
    );
  }

  if (!cuisine) {
    throw new Error(
      `Could not find cuisine in line: "${line}"\nParsed: name="${name}", neighborhood="${neighborhood}"`
    );
  }

  return {
    name,
    neighborhood,
    cuisine,
    price,
    address: "",
  };
}

async function main(): Promise<void> {
  const inputFile = process.argv[2] || "data/restaurants.txt";
  const outputFile = inputFile.replace(/\.txt$/, ".csv");

  console.log("=".repeat(80));
  console.log("LA RESTAURANTS - PARSED DATA");
  console.log("=".repeat(80) + "\n");

  // Load restaurant data
  console.log(`📂 Loading ${inputFile}...`);
  const restaurantsRaw = await readFile(inputFile, "utf-8");
  console.log("✓ Loaded\n");

  // Parse all restaurants
  const restaurants: Restaurant[] = [];
  const lines = restaurantsRaw.trim().split("\n");

  for (const line of lines) {
    if (line.trim()) {
      restaurants.push(parseLine(line));
    }
  }

  console.log(`Parsed ${restaurants.length} restaurants\n`);

  // Show first 10 as examples
  console.log("Sample (first 10):");
  console.log("-".repeat(80));
  for (const [index, r] of restaurants.slice(0, 10).entries()) {
    const num = String(index + 1).padStart(2);
    const name = r.name.padEnd(35);
    const hood = r.neighborhood.padEnd(25);
    const cuisine = r.cuisine.padEnd(20);
    console.log(`${num}. ${name} | ${hood} | ${cuisine} | ${r.price}`);
  }
  console.log();

  // Create CSV
  const records = [];
  for (const r of restaurants) {
    records.push({
      Name: r.name,
      Neighborhood: r.neighborhood,
      Address: "",
      Cuisine: r.cuisine,
      Price: r.price,
    });
  }

  const csvContent = stringify(records, {
    header: true,
    columns: ["Name", "Neighborhood", "Address", "Cuisine", "Price"],
  });

  await writeFile(outputFile, csvContent, "utf-8");
  console.log(
    `✓ Saved to ${outputFile} (addresses empty - ready for address lookup)\n`
  );

  console.log("=".repeat(80));
  console.log("NEXT STEPS");
  console.log("=".repeat(80));
  console.log(`
Next, run the address lookup tool:

  pnpm run lookup

This will:
  - Automatically look up addresses using Google Places API
  - Prompt you to confirm or select from multiple matches
  - Update ${outputFile} with the addresses

After that, import ${outputFile} to Google My Maps
    `);
}

await main();
