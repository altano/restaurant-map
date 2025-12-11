#!/usr/bin/env node

/**
 * Address Lookup Tool using Google Places API (New)
 * Free tier: 10,000 requests/month
 */

import { readFile, writeFile } from "node:fs/promises";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const RestaurantSchema = z.object({
  name: z.string(),
  neighborhood: z.string(),
  cuisine: z.string(),
  price: z.string(),
  address: z.string(),
});

type Restaurant = z.infer<typeof RestaurantSchema>;

const GooglePlacesDisplayNameSchema = z.object({
  text: z.string(),
  languageCode: z.string().optional(),
});

const GooglePlacesResultSchema = z.object({
  id: z.string(),
  displayName: GooglePlacesDisplayNameSchema,
  formattedAddress: z.string(),
  types: z.array(z.string()).optional(),
});

const GooglePlacesResponseSchema = z.object({
  places: z.array(GooglePlacesResultSchema).optional(),
});

type GooglePlacesResult = z.infer<typeof GooglePlacesResultSchema>;

class GooglePlacesLookupService {
  private rl: readline.Interface;
  private cache: Map<string, string> = new Map();
  private requestCount = 0;
  private outputFile: string;
  private apiKey: string;

  constructor(outputFile: string, apiKey: string) {
    this.rl = readline.createInterface({ input, output });
    this.outputFile = outputFile;
    this.apiKey = apiKey;
  }

  /**
   * Save progress to CSV file
   */
  async saveProgress(restaurants: Restaurant[]): Promise<void> {
    const csvContent = serializeRestaurantsCSV(restaurants);
    await writeFile(this.outputFile, csvContent, "utf-8");
    console.log(`  💾 Progress saved to ${this.outputFile}`);
  }

  /**
   * Search using Google Places API Text Search
   */
  async searchGooglePlaces(
    restaurantName: string,
    neighborhood: string
  ): Promise<GooglePlacesResult[]> {
    this.requestCount++;

    const textQuery = `${restaurantName} ${neighborhood} Los Angeles, CA`;
    console.log(`  🔍 Searching Google Places: "${textQuery}"`);

    const url = "https://places.googleapis.com/v1/places:searchText";

    const body = {
      textQuery: textQuery,
      locationBias: {
        circle: {
          center: {
            latitude: 34.0522,
            longitude: -118.2437,
          },
          radius: 50000.0, // ~31 miles, covers Greater LA
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "Content-Type": "application/json",
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.id,places.types",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google Places API error (${response.status}): ${response.statusText}. ${errorText}`
        );
      }

      const json = await response.json();
      const parseResult = GooglePlacesResponseSchema.safeParse(json);

      if (!parseResult.success) {
        console.error(
          `  ⚠️  Failed to parse Google Places response: ${parseResult.error}`
        );
        return [];
      }

      return parseResult.data.places || [];
    } catch (error) {
      console.error(`  ❌ Google Places API error: ${error}`);
      return [];
    }
  }

  /**
   * Interactive prompt to select from multiple location options
   */
  async selectFromMultiple(
    restaurant: Restaurant,
    results: GooglePlacesResult[]
  ): Promise<string> {
    console.log(
      `\n📍 Multiple locations found for "${restaurant.name}" in ${restaurant.neighborhood}:\n`
    );

    const displayResults = results.slice(0, 5); // Show max 5 results

    for (const [index, result] of displayResults.entries()) {
      console.log(`  ${index + 1}. ${result.formattedAddress}`);
    }

    console.log(`  ${displayResults.length + 1}. Skip this restaurant`);
    console.log(`  ${displayResults.length + 2}. Enter address manually\n`);

    while (true) {
      const answer = await this.rl.question(
        `Select option (1-${displayResults.length + 2}): `
      );
      const choice = parseInt(answer.trim());

      if (choice >= 1 && choice <= displayResults.length) {
        const selected = displayResults[choice - 1];
        if (selected) {
          return selected.formattedAddress;
        }
      } else if (choice === displayResults.length + 1) {
        return ""; // Skip
      } else if (choice === displayResults.length + 2) {
        const manual = await this.rl.question("Enter address: ");
        return manual.trim();
      } else {
        console.log("Invalid choice. Please try again.");
      }
    }
  }

  /**
   * Look up address for a single restaurant
   */
  async lookupAddress(restaurant: Restaurant): Promise<string> {
    const cacheKey = `${restaurant.name}|${restaurant.neighborhood}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`  ✓ Using cached result`);
      return this.cache.get(cacheKey)!;
    }

    // If address already exists, skip
    if (restaurant.address && restaurant.address.trim()) {
      console.log(`  ✓ Address already exists: ${restaurant.address}`);
      return restaurant.address;
    }

    try {
      // Single Google Places search (no fallback needed - very accurate)
      const results = await this.searchGooglePlaces(
        restaurant.name,
        restaurant.neighborhood
      );

      let address = "";

      if (results.length === 0) {
        // No results - prompt for manual entry
        console.log(`  ⚠️  No results found`);
        const manual = await this.rl.question(
          "  Enter address manually or press Enter to skip: "
        );
        address = manual.trim();
      } else if (results.length === 1) {
        // Single result - auto-accept
        const firstResult = results[0];
        if (firstResult) {
          address = firstResult.formattedAddress;
          console.log(`  ✓ Found: ${address}`);
        }
      } else {
        // Multiple results - let user select
        address = await this.selectFromMultiple(restaurant, results);
      }

      // Cache the result
      this.cache.set(cacheKey, address);
      return address;
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
      const manual = await this.rl.question(
        "  Enter address manually or press Enter to skip: "
      );
      return manual.trim();
    }
  }

  /**
   * Process all restaurants with address lookup
   */
  async processRestaurants(restaurants: Restaurant[]): Promise<Restaurant[]> {
    const needsLookup = restaurants.filter(
      (r) => !r.address || !r.address.trim()
    );
    const alreadyHasAddress = restaurants.length - needsLookup.length;

    console.log(`\n${"=".repeat(80)}`);
    console.log(
      `GOOGLE PLACES ADDRESS LOOKUP - Processing ${restaurants.length} restaurants`
    );
    console.log(`${"=".repeat(80)}\n`);
    console.log("Using Google Places API - 10k free requests/month!");
    console.log("No rate limits - fast lookups!\n");

    if (alreadyHasAddress > 0) {
      console.log(
        `✓ Skipping ${alreadyHasAddress} restaurants that already have addresses\n`
      );
    }

    // Work with a mutable copy of the full restaurant list
    const results = [...restaurants];
    let processedCount = 0;

    for (let i = 0; i < results.length; i++) {
      const restaurant = results[i];
      if (!restaurant) continue;

      // Skip if already has address
      if (restaurant.address && restaurant.address.trim()) {
        continue;
      }

      processedCount++;
      console.log(
        `\n[${processedCount}/${needsLookup.length}] ${restaurant.name} (${restaurant.neighborhood})`
      );

      const address = await this.lookupAddress(restaurant);

      // Update in place to maintain full list
      results[i] = {
        ...restaurant,
        address,
      };

      // Save progress after each address lookup
      if (address && address.trim()) {
        await this.saveProgress(results);
      }
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log(`SUMMARY`);
    console.log(`${"=".repeat(80)}`);
    console.log(`Total restaurants: ${restaurants.length}`);
    console.log(`Addresses found: ${results.filter((r) => r.address).length}`);
    console.log(`API requests made: ${this.requestCount}`);
    console.log(
      `Estimated cost: $${(this.requestCount * 0.01).toFixed(
        2
      )} (likely $0.00 under free tier)`
    );

    return results;
  }

  close(): void {
    this.rl.close();
  }
}

function parseRestaurantsCSV(csvContent: string): Restaurant[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as Array<{
    Name: string;
    Neighborhood: string;
    Address: string;
    Cuisine: string;
    Price: string;
  }>;

  const restaurants: Restaurant[] = [];
  for (const record of records) {
    restaurants.push({
      name: record.Name,
      neighborhood: record.Neighborhood,
      address: record.Address || "",
      cuisine: record.Cuisine,
      price: record.Price,
    });
  }

  return restaurants;
}

function serializeRestaurantsCSV(restaurants: Restaurant[]): string {
  const records = [];
  for (const r of restaurants) {
    records.push({
      Name: r.name,
      Neighborhood: r.neighborhood,
      Address: r.address,
      Cuisine: r.cuisine,
      Price: r.price,
    });
  }

  return stringify(records, {
    header: true,
    columns: ["Name", "Neighborhood", "Address", "Cuisine", "Price"],
  });
}

async function main(): Promise<void> {
  try {
    const inputFile = process.argv[2] || "data/la-times-101-best-2025.csv";

    console.log(`${"=".repeat(80)}`);
    console.log("GOOGLE PLACES API ADDRESS LOOKUP");
    console.log(`${"=".repeat(80)}\n`);

    // Load API key from api.env
    console.log(`🔑 Loading API key from api.env...`);
    const envPath = new URL("../api.env", import.meta.url);

    let apiKey: string;
    try {
      const envContent = await readFile(envPath, "utf-8");
      const apiKeyMatch = envContent.match(/GOOGLE_PLACES_API_KEY=(.+)/);

      if (!apiKeyMatch || !apiKeyMatch[1]) {
        throw new Error("API key not found in file");
      }

      apiKey = apiKeyMatch[1].trim();
      console.log(`✓ API key loaded\n`);
    } catch (error) {
      console.error(`❌ Error: Could not load API key from api.env`);
      console.error(`   ${error}`);
      console.error(`\nPlease:`);
      console.error(`  1. Copy api.example.env to api.env`);
      console.error(`  2. Add your Google Places API key to api.env`);
      console.error(`  3. Get a key at: https://console.cloud.google.com/\n`);
      process.exit(1);
    }

    console.log("✓ Google Places API (New)");
    console.log("✓ 10,000 free requests/month");
    console.log("✓ Excellent restaurant coverage");
    console.log("✓ No rate limits - fast processing\n");

    // Load restaurants from CSV
    console.log(`📂 Loading ${inputFile}...`);
    const csvData = await readFile(inputFile, "utf-8");
    const restaurants = parseRestaurantsCSV(csvData);
    console.log(`✓ Loaded ${restaurants.length} restaurants\n`);

    const needsLookup = restaurants.filter(
      (r) => !r.address || !r.address.trim()
    );
    console.log(`📍 ${needsLookup.length} restaurants need address lookup\n`);

    if (needsLookup.length === 0) {
      console.log("✓ All restaurants already have addresses!");
      console.log(`\nYou can now import ${inputFile} to Google My Maps.\n`);
      return;
    }

    const rl = readline.createInterface({ input, output });
    const proceed = await rl.question("Continue? (Y/n): ");
    rl.close();

    if (proceed.toLowerCase() === "n") {
      console.log("Cancelled.");
      process.exit(0);
    }

    // Process lookups
    const service = new GooglePlacesLookupService(inputFile, apiKey);
    const updated = await service.processRestaurants(restaurants);
    service.close();

    // Save results to CSV
    console.log(`\n💾 Saving final results...`);
    const csvContent = serializeRestaurantsCSV(updated);
    await writeFile(inputFile, csvContent, "utf-8");
    console.log(`✓ Updated ${inputFile}`);

    console.log(`\n${"=".repeat(80)}`);
    console.log("✓ ADDRESS LOOKUP COMPLETE!");
    console.log(`${"=".repeat(80)}\n`);
    console.log("Next steps:");
    console.log(`1. Review ${inputFile} for any missing addresses`);
    console.log("2. Import to Google My Maps (https://mymaps.google.com)");
    console.log("3. Create your custom restaurant map!\n");
  } catch (error) {
    console.error(`\n❌ Error: ${error}`);
    process.exit(1);
  }
}

await main();
