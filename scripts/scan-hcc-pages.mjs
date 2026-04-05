/**
 * scan-hcc-pages.mjs
 *
 * Analisa as imagens 1bpp de cada página do HCC PDF para detectar
 * visualmente onde cada hino começa (cabeçalho com número + título).
 *
 * Uso: node scripts/scan-hcc-pages.mjs [startPage] [endPage]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const INPUT = path.join(appRoot, 'public', 'pdfs', 'hinario-culto-cristao.pdf');
const standardFontDataUrl = new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href;

// ---- Get first large image XObject from a page via page.objs callback ---

function getPageMainImage(page) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), 8000);

    try {
      const opList = await page.getOperatorList();
      const imgRefs = [];

      opList.fnArray.forEach((fn, i) => {
        if (fn === 85 /*paintImageXObject*/) {
          imgRefs.push({ ref: opList.argsArray[i][0], width: opList.argsArray[i][1], height: opList.argsArray[i][2] });
        }
      });

      if (!imgRefs.length) {
        clearTimeout(timeout);
        resolve(null);
        return;
      }

      // Sort by area, take largest (= the scanned page)
      imgRefs.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      const largest = imgRefs[0];

      page.objs.get(largest.ref, (imgData) => {
        clearTimeout(timeout);
        if (imgData) {
          resolve(imgData);
        } else {
          reject(new Error('null image data for ' + largest.ref));
        }
      });
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}

/**
 * Compute the fraction of BLACK pixels in a horizontal band for a 1bpp image.
 * rowStart and rowEnd are 0-based row indices.
 * For 1bpp: each byte encodes 8 pixels; the MSB is the leftmost pixel.
 */
function topBandBlackFraction(imgData, rowStart, rowEnd) {
  const { width, height, data, kind } = imgData;

  if (!data || !data.length) return 0;

  const rEnd = Math.min(rowEnd, height);
  let blackBits = 0;
  let totalBits = 0;

  if (kind === 1) {
    // GRAYSCALE_1BPP
    const bytesPerRow = Math.ceil(width / 8);
    for (let row = rowStart; row < rEnd; row++) {
      const rowBase = row * bytesPerRow;
      for (let b = 0; b < bytesPerRow; b++) {
        const byte = data[rowBase + b];
        const pixelsInByte = Math.min(8, width - b * 8);
        for (let bit = 0; bit < pixelsInByte; bit++) {
          const pixel = (byte >> (7 - bit)) & 1;
          if (pixel) blackBits++;
          totalBits++;
        }
      }
    }
  } else if (kind === 2) {
    // RGB_24BPP (3 bytes per pixel)
    const bytesPerRow = width * 3;
    for (let row = rowStart; row < rEnd; row++) {
      const rowBase = row * bytesPerRow;
      for (let x = 0; x < width; x++) {
        const r = data[rowBase + x * 3];
        const g = data[rowBase + x * 3 + 1];
        const b = data[rowBase + x * 3 + 2];
        const brightness = (r + g + b) / 3;
        if (brightness < 128) blackBits++;
        totalBits++;
      }
    }
  } else {
    // Fallback: just check byte values
    const sliceStart = Math.floor(rowStart * data.length / height);
    const sliceEnd = Math.ceil(rEnd * data.length / height);
    for (let i = sliceStart; i < sliceEnd; i++) {
      if (data[i] > 128) blackBits++;
      totalBits++;
    }
  }

  return totalBits ? blackBits / totalBits : 0;
}

async function main() {
  const args = process.argv.slice(2);
  const startPage = args[0] ? parseInt(args[0]) : 1;
  const endPage = args[1] ? parseInt(args[1]) : null;

  const rawData = new Uint8Array(await fs.readFile(INPUT));
  const doc = await pdfjs.getDocument({ data: rawData, standardFontDataUrl }).promise;
  const totalPages = doc.numPages;
  const end = endPage ?? totalPages;

  console.log(`Escaneando páginas ${startPage}–${end} de ${totalPages}...\n`);
  console.log('PAGE | KIND | W     | H     | TOP_2% | TOP_5% | TOP_10% | TOP_20% | bodY_20-60%');
  console.log('-'.repeat(80));

  for (let p = startPage; p <= end; p++) {
    const page = await doc.getPage(p);
    try {
      const img = await getPageMainImage(page);
      if (!img) {
        console.log(`P${String(p).padStart(4)} | NO IMAGE`);
        continue;
      }

      const h = img.height;
      const top2 = topBandBlackFraction(img, 0, Math.floor(h * 0.02));
      const top5 = topBandBlackFraction(img, 0, Math.floor(h * 0.05));
      const top10 = topBandBlackFraction(img, 0, Math.floor(h * 0.10));
      const top20 = topBandBlackFraction(img, 0, Math.floor(h * 0.20));
      const body = topBandBlackFraction(img, Math.floor(h * 0.20), Math.floor(h * 0.60));

      const fmt = (n) => n.toFixed(3);
      console.log(
        `P${String(p).padStart(4)} | k${img.kind} | ${String(img.width).padStart(5)} | ${String(h).padStart(5)} | ${fmt(top2)} | ${fmt(top5)} | ${fmt(top10)}  | ${fmt(top20)}  | ${fmt(body)}`
      );
    } catch (e) {
      console.log(`P${String(p).padStart(4)} | ERR: ${e.message}`);
    }
  }

  await doc.destroy();
}

main().catch(e => { console.error(e); process.exitCode = 1; });

