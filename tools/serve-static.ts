/**
 * Serves dist/ the way GitHub Pages does, for E2E tests and local previews of the real output:
 * directory URLs resolve to index.html, a directory without its trailing slash redirects (301)
 * to it, and anything missing gets dist/404.html with status 404. Local use only.
 *
 *   pnpm serve [--port 4321] [--dir dist]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { port: { type: 'string', default: '4321' }, dir: { type: 'string', default: 'dist' } },
});
const root = normalize(values.dir);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = '/';
  }
  const file = normalize(join(root, pathname));
  const send = (path: string, status = 200) => {
    response.writeHead(status, {
      'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
    });
    createReadStream(path).pipe(response);
  };
  if (file !== root && !file.startsWith(root + sep)) return send(join(root, '404.html'), 404);
  if (isFile(file)) return send(file);
  if (isFile(join(file, 'index.html'))) {
    if (pathname.endsWith('/')) return send(join(file, 'index.html'));
    response.writeHead(301, { location: `${pathname}/${url.search}` });
    return response.end();
  }
  return send(join(root, '404.html'), 404);
}).listen(Number(values.port), () =>
  console.log(`Serving ${root}/ at http://localhost:${values.port}/`),
);
