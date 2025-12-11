# LA Restaurant Map Builder

A tool to parse LA Times restaurant data and automatically look up addresses using Google Places API, then export to formats ready for Google My Maps.

## Features

- Parse restaurant data from text format
- **Google Places API address lookup** with excellent restaurant coverage
- Interactive prompts for ambiguous locations
- Fast lookups with no rate limits
- Export to CSV format
- Ready for Google My Maps csv import

## Prerequisites

1. Node.js (v18 or higher)
2. pnpm (or npm)
3. Google Places API key

## Installation

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Get a Google Places API key:

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or select existing)
   - Enable "Places API (New)"
   - Create an API key
   - Copy `api.example.env` to `api.env`
   - Add your API key to `api.env`

3. (Optional) Restrict your API key:
   - In Google Cloud Console, restrict key to Places API only
   - Add application restrictions if needed

## Usage

### Step 1: Parse Restaurant Data

First, run the parser to create the initial restaurant files:

```bash
pnpm run parse
```

This generates:

- `data/la-times-101-best-2025.csv` - CSV format for Google My Maps

### Step 2: Look Up Addresses

Run the Google Places API lookup tool:

```bash
pnpm run lookup
```

Features:

- ✓ Uses Google Places API - excellent restaurant coverage
- ✓ 10,000 free requests/month (plenty for 100 restaurants)
- ✓ Fast - no rate limits
- ✓ Interactive prompts for confirmation
- ✓ Auto-accepts single results
- ✓ Progress saved after each lookup

The tool will:

- Search for each restaurant using Google's database
- Auto-accept when only one match is found
- Prompt you to select when multiple locations exist
- Allow manual address entry when needed
- Update `la-times-101-best-2025.csv` with addresses

### Step 3: Import to Google My Maps

1. Go to https://mymaps.google.com
2. Create a new map
3. Click "Import"
4. Upload `data/la-times-101-best-2025.csv`
5. Map the columns: Name → Name, Address → Address
6. Google My Maps will geocode the addresses
7. Customize your map with colors, icons, and layers

## Interactive Prompts

When multiple locations are found, you'll see:

```
📍 Multiple locations found for "Panda Inn" in Alhambra:

  1. 123 Main St, Alhambra, CA 91801, USA
  2. 456 Oak Ave, Pasadena, CA 91101, USA
  3. Skip this restaurant
  4. Enter address manually

Select option (1-4):
```

Options:

- Select a numbered location to use that address
- Choose "Skip" to leave the address blank
- Choose "Enter manually" to type a custom address

## File Structure

```
restaurant-map/
├── src/
│   ├── make-csv.ts             # Restaurant parser
│   └── address-lookup.ts       # Address lookup (Google Places API)
├── data/
│   ├── la-times-101-best-2025.txt         # Input: Raw restaurant data
│   └── la-times-101-best-2025.csv         # Output: CSV for Google My Maps
├── api.example.env             # API key template
├── api.env                     # Your API key (gitignored)
├── package.json
└── README.md
```

## Troubleshooting

**API Key Error**: Make sure you've created `api.env` from `api.example.env` and added your real Google Places API key.

**No Results Found**: Google Places has excellent coverage, but if a restaurant isn't found, you can manually enter the address during the interactive prompt.

**API Quota Exceeded**: The free tier provides 10,000 requests/month. For 100 restaurants, you'll use ~100 requests. If you hit the limit, wait until next month or enable billing (very cheap - ~$0.01 per request after free tier).

**Rate Limiting**: Unlike OpenStreetMap, Google Places has no rate limits, so lookups are fast.

**Inaccurate Results**: If a restaurant address seems wrong, you can:

- Select a different option from the multiple results
- Choose "Enter address manually" from the prompt
- Edit `data/la-times-101-best-2025.csv` directly afterward

## References

- [Google Places API (New) Documentation](https://developers.google.com/maps/documentation/places/web-service/op-overview)
- [Text Search API](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google My Maps](https://mymaps.google.com)
