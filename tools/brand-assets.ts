/**
 * Regenerates the site's brand files from the two sources in docs/brand/ (white background):
 * - logo.webp (symbol + "NewsMapp")  → public/og.png, 1200×630 share image (og:image)
 * - symbol.webp (symbol only)        → public/favicon.ico (32 px), public/apple-touch-icon.png
 *                                       (180 px) and public/mark.webp (header, 64 px for 2×)
 * Run after changing a source: pnpm brand:assets, then commit the outputs.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const SRC = 'docs/brand';

/** The source cropped to its drawing, centred on a white square with a margin. */
async function squareSymbol(size: number, margin: number): Promise<Buffer> {
  const inner = Math.round(size * (1 - 2 * margin));
  const art = await sharp(`${SRC}/symbol.webp`)
    .trim({ background: '#ffffff', threshold: 20 })
    .resize(inner, inner, { fit: 'contain', background: WHITE })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toBuffer();
}

/** An ICO file holding one PNG image (supported by every current browser). */
function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt8(0, 8); // no palette
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([header, png]);
}

writeFileSync('public/favicon.ico', icoFromPng(await squareSymbol(32, 0.04), 32));
writeFileSync('public/apple-touch-icon.png', await squareSymbol(180, 0.1));
await sharp(await squareSymbol(64, 0.04))
  .webp({ quality: 90 })
  .toFile('public/mark.webp');

const logo = await sharp(`${SRC}/logo.webp`)
  .trim({ background: '#ffffff', threshold: 20 })
  .resize(1000, 500, { fit: 'contain', background: WHITE })
  .toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
  .composite([{ input: logo, gravity: 'centre' }])
  .png({ compressionLevel: 9, palette: true })
  .toFile('public/og.png');

console.log('Brand files written: favicon.ico, apple-touch-icon.png, mark.webp, og.png');
