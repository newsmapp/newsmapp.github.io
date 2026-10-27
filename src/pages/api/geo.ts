import type { APIRoute } from 'astro';
import { json, visitorCountry } from '../../server/http';

export const prerender = false;

/** Visitor country for the VPN offer rule (R2). Country only; nothing is stored. */
export const GET: APIRoute = ({ request }) => json({ country: visitorCountry(request) });
