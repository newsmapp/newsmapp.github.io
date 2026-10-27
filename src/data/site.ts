import { ADS_ENABLED } from 'astro:env/server';

export const SITE_NAME = 'NewsMap';
/** Display ads stay off until the network approves the site and the CMP is configured. */
export const adsEnabled = ADS_ENABLED;
