import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/schemas/**/*.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
      reporter: ['text-summary', 'html'],
    },
  },
});
