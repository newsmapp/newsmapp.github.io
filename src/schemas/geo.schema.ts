import { z } from 'zod';
import { CONTINENTS, iso2, iso3, text } from './common';

export const geoCountrySchema = z.strictObject({
  iso2,
  iso3,
  name: text,
  continent: z.enum(CONTINENTS),
  also_in: z.array(z.enum(CONTINENTS)),
  official_languages: z.array(z.string().regex(/^[a-z]{2,3}$/)),
  neighbors: z.array(iso2),
});

export const geoCountriesSchema = z.array(geoCountrySchema);

export type GeoCountry = z.infer<typeof geoCountrySchema>;
