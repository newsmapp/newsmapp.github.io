import affiliatesJson from '../../data/monetization/affiliates.json';
import sponsorshipsJson from '../generated/sponsorships.json';
import { affiliatesFileSchema } from '../schemas/monetization.schema';
import type { Category } from '../schemas/catalog.schema';
import type { Sponsorship } from '../components/SponsoredSlot.astro';

export const affiliates = affiliatesFileSchema.parse(affiliatesJson);

interface SnapshotEntry extends Sponsorship {
  country: string;
  category: Category;
  position: number;
}

/** Active sponsorships exported from D1 at build time (`pnpm sponsorships:snapshot`). */
const snapshot = sponsorshipsJson as SnapshotEntry[];

export function sponsorshipsFor(country: string, category: Category): Sponsorship[] {
  return snapshot
    .filter((s) => s.country === country && s.category === category)
    .sort((a, b) => a.position - b.position);
}

import pricingJson from '../../data/monetization/pricing.json';
import { pricingFileSchema } from '../schemas/monetization.schema';

export const pricing = pricingFileSchema.parse(pricingJson);
