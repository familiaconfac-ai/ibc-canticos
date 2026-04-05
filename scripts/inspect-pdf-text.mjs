/**
 * Diagnostic script: dumps all text items from the first N pages of a PDF.
 * Run: node scripts/inspect-pdf-text.mjs [pdfPath] [pages=10]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const standardFontDataUrl = new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href;

const pdfPath = process.argv[2] ?? path.join(__dirname, '..', 'public', 'pdfs', 'hinario-culto-cristao.pdf');
const maxPages = Number(process.argv[3] ?? 10);

const data = new Uint8Array(await fs.readFile(pdfPath));
const doc = await pdfjs.getDocument({ data, standardFontDataUrl }).promise;

console.log(`PDF: ${path.basename(pdfPath)} — ${doc.numPages} páginas\n`);

for (let p = 1; p <= Math.min(maxPages, doc.numPages); p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });

  console.log(`\n=== Página ${p} (h=${viewport.height.toFixed(1)}) ===`);

  const items = content.items
    .map((item) => ({
      text: (item.str ?? '').replace(/\s+/g, ' ').trim(),
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      scaleX: Math.abs(item.transform[0]).toFixed(1),
      scaleY: Math.abs(item.transform[3]).toFixed(1),
      w: Math.round(item.width ?? 0),
    }))
    .filter((i) => i.text);

  for (const item of items) {
    console.log(`  [${item.x},${item.y}] scl=${item.scaleX}x${item.scaleY} w=${item.w}  "${item.text}"`);
  }
}

await doc.destroy();
