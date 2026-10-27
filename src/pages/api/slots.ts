import type { APIRoute } from 'astro';
import { z } from 'zod';
import { CATEGORIES } from '../../schemas/catalog.schema';
import { json, problem, respond } from '../../server/http';
import { openSlots } from '../../server/sponsorships';
import { db, pricing } from '../../runtime/worker';

export const prerender = false;

const query = z.object({ country: z.string().regex(/^[A-Z]{2}$/), category: z.enum(CATEGORIES) });

export const GET: APIRoute = ({ url }) =>
  respond(async () => {
    const parsed = query.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return problem(400, 'Choose a country and a category.');
    const total = pricing.slots_per_category;
    const available = await openSlots(
      db(),
      parsed.data.country,
      parsed.data.category,
      total,
      new Date(),
    );
    return json({ available, total });
  });
