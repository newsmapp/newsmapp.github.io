/** Build-time snapshot of sponsored listings (SPEC §3.6.1): what the static pages embed. */
export interface SponsorshipRow {
  id: string;
  outlet_id: string | null;
  outlet_name: string;
  outlet_url: string;
  country_iso: string;
  category: string;
  slot_position: number;
  status: string;
}

export interface SnapshotEntry {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  country: string;
  category: string;
  position: number;
}

/** Listed slots only: active, or in the 7-day grace period after a failed payment. */
export function toSnapshot(
  rows: readonly SponsorshipRow[],
  iconFor: (outletId: string) => string | null,
): SnapshotEntry[] {
  return rows
    .filter((row) => row.status === 'active' || row.status === 'grace')
    .map((row) => ({
      id: row.id,
      name: row.outlet_name,
      url: row.outlet_url,
      icon: row.outlet_id ? iconFor(row.outlet_id) : null,
      country: row.country_iso,
      category: row.category,
      position: row.slot_position,
    }))
    .sort(
      (a, b) =>
        a.country.localeCompare(b.country) ||
        a.category.localeCompare(b.category) ||
        a.position - b.position,
    );
}

export const SNAPSHOT_SQL =
  "SELECT id, outlet_id, outlet_name, outlet_url, country_iso, category, slot_position, status FROM sponsorships WHERE status IN ('active', 'grace')";
