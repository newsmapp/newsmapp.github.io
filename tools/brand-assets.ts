/**
 * Regenerates the site's brand files from the two sources in docs/brand/ (white background):
 * - logo.webp (symbol + "NewsMapp")  → public/og.png, 1200×630 share image (og:image)
 * - symbol.webp (symbol only)        → public/favicon.ico (32 px) and public/mark.webp (header,
 *                                       64 px for 2×) on a transparent background, and
 *                                       public/apple-touch-icon.png (180 px, opaque: iOS fills
 *                                       transparency with black)
 * Run after changing a source: pnpm brand:assets, then commit the outputs.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 255, g: 255, b: 255, alpha: 0 };
const SRC = 'docs/brand';
/** Channels at or above this count as the white background. */
const PAPER = 236;

/**
 * The symbol with its outer white removed. Only white connected to the image border becomes
 * transparent (a flood fill), so the white pages inside the drawing stay white. Anti-aliased edge
 * pixels, a blend of the outline and white, are un-blended into partial transparency so no light
 * fringe shows on a dark browser tab.
 */
async function cutoutSymbol(): Promise<Buffer> {
  const { data, info } = await sharp(`${SRC}/symbol.webp`)
    .trim({ background: '#ffffff', threshold: 20 })
    .extend({ top: 4, bottom: 4, left: 4, right: 4, background: WHITE })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const isPaper = (i: number) =>
    (data[i] ?? 0) >= PAPER && (data[i + 1] ?? 0) >= PAPER && (data[i + 2] ?? 0) >= PAPER;

  const outside = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x += 1) stack.push(x, 0, x, height - 1);
  for (let y = 0; y < height; y += 1) stack.push(0, y, width - 1, y);
  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (outside[p] || !isPaper(p * 4)) continue;
    outside[p] = 1;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const i = p * 4;
      if (outside[p]) {
        data[i + 3] = 0;
        continue;
      }
      const touchesOutside =
        (x > 0 && outside[p - 1]) ||
        (x < width - 1 && outside[p + 1]) ||
        (y > 0 && outside[p - width]) ||
        (y < height - 1 && outside[p + width]);
      if (!touchesOutside) continue;
      // Edge pixel = a·colour + (1−a)·white. The darkest channel bounds a from below.
      const min = Math.min(data[i] ?? 255, data[i + 1] ?? 255, data[i + 2] ?? 255);
      const alpha = Math.min(1, (255 - min) / 200);
      if (alpha <= 0.02) {
        data[i + 3] = 0;
        continue;
      }
      for (let c = 0; c < 3; c += 1) {
        const value = ((data[i + c] ?? 255) - 255 * (1 - alpha)) / alpha;
        data[i + c] = Math.max(0, Math.min(255, Math.round(value)));
      }
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

/** The symbol centred on a square of the given background, with a margin. */
async function squareSymbol(
  art: Buffer,
  size: number,
  margin: number,
  background: typeof WHITE,
): Promise<Buffer> {
  const inner = Math.round(size * (1 - 2 * margin));
  const resized = await sharp(art)
    .resize(inner, inner, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: resized, gravity: 'centre' }])
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

const symbol = await cutoutSymbol();
writeFileSync('public/favicon.ico', icoFromPng(await squareSymbol(symbol, 32, 0, CLEAR), 32));
writeFileSync('public/apple-touch-icon.png', await squareSymbol(symbol, 180, 0.1, WHITE));
await sharp(await squareSymbol(symbol, 64, 0, CLEAR))
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
