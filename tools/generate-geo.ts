/**
 * Regenerates data/geo/countries.json from the countries-list package (MIT).
 * Neighbors are curated by hand for launch countries; others start empty.
 * Run: pnpm geo:generate
 */
import { writeFileSync } from 'node:fs';
import { countries, getCountryData, type TCountryCode } from 'countries-list';
import { geoCountriesSchema, type GeoCountry } from '../src/schemas/geo.schema';
import type { Continent } from '../src/schemas/common';

const CONTINENT_BY_CODE: Record<string, Continent> = {
  AF: 'africa',
  AN: 'antarctica',
  AS: 'asia',
  EU: 'europe',
  NA: 'north-america',
  OC: 'oceania',
  SA: 'south-america',
};

/** Editorial placement where the source's primary continent differs from the site's. */
const PRIMARY_OVERRIDES: Partial<Record<string, Continent>> = { RU: 'europe', TR: 'asia' };

/** Land and close maritime neighbors used for "nearby countries" links. */
const NEIGHBORS: Partial<Record<string, string[]>> = {
  US: ['CA', 'MX', 'CU', 'BS'],
  CA: ['US', 'GL'],
  MX: ['US', 'GT', 'BZ', 'CU'],
  BR: ['AR', 'UY', 'PY', 'BO', 'PE', 'CO', 'VE', 'GY', 'SR', 'GF'],
  DE: ['FR', 'NL', 'BE', 'LU', 'CH', 'AT', 'CZ', 'PL', 'DK'],
  GB: ['IE', 'FR', 'NL', 'BE'],
  FR: ['BE', 'LU', 'DE', 'CH', 'IT', 'ES', 'MC', 'AD', 'GB'],
  IT: ['FR', 'CH', 'AT', 'SI', 'SM', 'VA', 'MT'],
  ES: ['PT', 'FR', 'AD', 'MA', 'GI'],
  NL: ['BE', 'DE', 'GB'],
  CH: ['DE', 'FR', 'IT', 'AT', 'LI'],
  RU: ['UA', 'BY', 'KZ', 'FI', 'EE', 'LV', 'LT', 'PL', 'GE', 'AZ', 'MN', 'CN', 'KP', 'JP'],
  CN: [
    'RU',
    'MN',
    'KZ',
    'KG',
    'TJ',
    'AF',
    'PK',
    'IN',
    'NP',
    'BT',
    'MM',
    'LA',
    'VN',
    'KP',
    'KR',
    'JP',
    'TW',
  ],
  JP: ['KR', 'CN', 'TW', 'RU'],
  IN: ['PK', 'CN', 'NP', 'BT', 'BD', 'MM', 'LK'],
  KR: ['KP', 'JP', 'CN'],
  ID: ['MY', 'SG', 'TL', 'PG', 'PH', 'AU'],
  SA: ['JO', 'IQ', 'KW', 'QA', 'BH', 'AE', 'OM', 'YE'],
  TR: ['GR', 'BG', 'GE', 'AM', 'AZ', 'IR', 'IQ', 'SY', 'CY'],
  AU: ['NZ', 'ID', 'PG'],
};

const result: GeoCountry[] = (Object.keys(countries) as TCountryCode[])
  .map((code) => {
    const data = getCountryData(code);
    const fromSource = CONTINENT_BY_CODE[data.continent];
    if (!fromSource) throw new Error(`Unknown continent ${data.continent} for ${code}`);
    const continent = PRIMARY_OVERRIDES[code] ?? fromSource;
    const all = (
      'continents' in data && Array.isArray(data.continents) ? data.continents : [data.continent]
    )
      .map((c) => CONTINENT_BY_CODE[c])
      .filter((c): c is Continent => c !== undefined);
    return {
      iso2: code,
      iso3: data.iso3,
      name: data.name,
      continent,
      also_in: [...new Set([...all, fromSource])].filter((c) => c !== continent).sort(),
      official_languages: [...data.languages],
      neighbors: NEIGHBORS[code] ?? [],
    };
  })
  .sort((a, b) => a.iso2.localeCompare(b.iso2));

const parsed = geoCountriesSchema.parse(result);
const known = new Set(parsed.map((c) => c.iso2));
for (const country of parsed) {
  for (const neighbor of country.neighbors) {
    if (!known.has(neighbor)) throw new Error(`${country.iso2}: unknown neighbor ${neighbor}`);
  }
}

writeFileSync(
  new URL('../data/geo/countries.json', import.meta.url),
  `${JSON.stringify(parsed, null, 2)}\n`,
);
console.log(`Wrote ${parsed.length} countries`);
