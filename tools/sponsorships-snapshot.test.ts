import { describe, expect, it } from 'vitest';
import { databaseId } from './sponsorships-snapshot';

describe('databaseId', () => {
  it('reads the D1 id from wrangler.jsonc text, comments included', () => {
    const config = `{
      // Replace with the id printed by wrangler d1 create
      "d1_databases": [{ "binding": "DB", "database_id": "3f2b1c4d-0000-4000-8000-1234567890ab" }]
    }`;
    expect(databaseId(config)).toBe('3f2b1c4d-0000-4000-8000-1234567890ab');
    expect(databaseId('{}')).toBeNull();
  });
});
