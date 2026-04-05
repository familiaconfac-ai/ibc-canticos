/**
 * Gera o mapa hino→página para o Hinário para o Culto Cristão (HCC).
 *
 * O PDF do HCC é uma digitalização em imagem (1bpp), sem camada de texto
 * extraível para a maioria das páginas. A estratégia usada é interpolação
 * linear por segmentos entre âncoras verificadas manualmente.
 *
 * Âncoras conhecidas (hymn → page):
 *   1  → 1   (usuário confirmou)
 *   34 → 23  (Gladstone Leon: "Deus dos Antigos HCC 34" em p.23)
 *   69 → 50  (usuário confirmou: p.50 mostra hino 69)
 *   80 → 58  (Gladstone Leon: "Bendito seja sempre o Cordeiro HCC 80" em p.58)
 *   422 → 339 (Gladstone Leon: "Como Agradecer a Jesus? HCC 422" em p.339)
 *   627 → 506 (último hino → última página do PDF, extrapolação)
 *
 * Saída: src/data/hinarioCultoCristaoMap.json
 * Formato: { "N": { number, title, startPage, endPage } }
 *
 * Para atualizar as âncoras quando mais pontos forem verificados,
 * edite o array ANCHORS abaixo e rode: node scripts/generate-hcc-map.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const INPUT = path.join(appRoot, 'public', 'pdfs', 'hinario-culto-cristao.pdf');
const OUTPUT = path.join(appRoot, 'src', 'data', 'hinarioCultoCristaoMap.json');
const standardFontDataUrl = new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href;

// ---------------------------------------------------------------------------
// Âncoras: { hymn, page }  — ordenadas por hymn
// Adicione mais âncoras aqui para aumentar a precisão do mapa.
// ---------------------------------------------------------------------------
const ANCHORS = [
  { hymn: 1,   page: 1   },
  { hymn: 34,  page: 23  },  // Gladstone Leon p.23: "Deus dos Antigos HCC 34"
  { hymn: 69,  page: 50  },  // Usuário: p.50 mostra hino 69
  { hymn: 80,  page: 58  },  // Gladstone Leon p.58: "Bendito seja sempre o Cordeiro HCC 80"
  { hymn: 422, page: 339 },  // Gladstone Leon p.339: "Como Agradecer a Jesus? HCC 422"
];

// ---------------------------------------------------------------------------
// Interpolação linear por segmentos
// ---------------------------------------------------------------------------

function interpolatePage(hymnNum, anchors, totalPages) {
  const sorted = [...anchors].sort((a, b) => a.hymn - b.hymn);

  // Extrapolation: before first anchor
  if (hymnNum <= sorted[0].hymn) {
    return sorted[0].page;
  }

  // Interpolation between anchor segments
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (hymnNum <= hi.hymn) {
      const t = (hymnNum - lo.hymn) / (hi.hymn - lo.hymn);
      return Math.round(lo.page + t * (hi.page - lo.page));
    }
  }

  // Extrapolation: beyond last anchor
  const last = sorted.at(-1);
  const prev = sorted.at(-2);
  const rate = (last.page - prev.page) / (last.hymn - prev.hymn);
  return Math.min(totalPages, Math.round(last.page + (hymnNum - last.hymn) * rate));
}

// ---------------------------------------------------------------------------
// Extração de texto de âncoras (somente para páginas Gladstone / texto real)
// ---------------------------------------------------------------------------

async function extractTextAnchors(document) {
  const anchors = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const fullText = textContent.items.map((i) => i.str || '').join(' ');

    // Match "HCC NNN" references in Gladstone Leon pages
    const matches = [...fullText.matchAll(/HCC\s+(\d{1,3})/gi)];
    for (const m of matches) {
      const hymnNum = Number(m[1]);
      if (hymnNum >= 1 && !anchors.some((a) => a.hymn === hymnNum)) {
        // Find hymn title on the same page
        const titleMatch = fullText.match(/\)\s+HCC\s+\d+|HCC\s+\d+\s+[-–]/);
        anchors.push({ hymn: hymnNum, page: pageNumber, source: 'text' });
      }
    }
  }

  return anchors;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nLendo PDF: ${path.relative(appRoot, INPUT)}`);

  const data = new Uint8Array(await fs.readFile(INPUT));
  const document = await pdfjs.getDocument({ data, standardFontDataUrl }).promise;
  const totalPages = document.numPages;
  console.log(`Total de páginas: ${totalPages}`);

  // Try to extract more anchors from text layers in the PDF
  console.log('\nBuscando âncoras de texto no PDF...');
  const textAnchors = await extractTextAnchors(document);
  if (textAnchors.length > 0) {
    console.log(`  Âncoras de texto encontradas: ${textAnchors.length}`);
    textAnchors.forEach((a) => console.log(`    Hino ${a.hymn} → página ${a.page}`));
  } else {
    console.log('  Nenhuma âncora de texto adicional encontrada (PDF é imagem).');
  }

  await document.destroy();

  // Merge all anchors (text-extracted + manual), deduplicate by hymn
  const allAnchors = [...ANCHORS];
  for (const ta of textAnchors) {
    if (!allAnchors.some((a) => a.hymn === ta.hymn)) {
      allAnchors.push(ta);
    }
  }
  allAnchors.sort((a, b) => a.hymn - b.hymn);

  // Add final extrapolation anchor at last page
  const lastHymn = 627; // HCC has 627 hymns
  if (!allAnchors.some((a) => a.hymn >= lastHymn)) {
    const lastAnchor = allAnchors.at(-1);
    const prevAnchor = allAnchors.at(-2);
    const rate = (lastAnchor.page - prevAnchor.page) / (lastAnchor.hymn - prevAnchor.hymn);
    const estimatedLastPage = Math.min(totalPages, Math.round(lastAnchor.page + (lastHymn - lastAnchor.hymn) * rate));
    allAnchors.push({ hymn: lastHymn, page: estimatedLastPage, source: 'extrapolated' });
  }

  console.log('\nÂncoras usadas para interpolação:');
  allAnchors.forEach((a) =>
    console.log(`  Hino ${String(a.hymn).padStart(3)} → página ${String(a.page).padStart(3)}${a.source ? ' (' + a.source + ')' : ''}`),
  );

  // Build map for all hymns 1..627
  const map = {};
  for (let n = 1; n <= lastHymn; n++) {
    const startPage = interpolatePage(n, allAnchors, totalPages);
    const endPage = interpolatePage(n + 1, allAnchors, totalPages) > startPage
      ? interpolatePage(n + 1, allAnchors, totalPages) - 1
      : startPage;

    map[String(n)] = {
      number: String(n),
      title: '',   // título não disponível — PDF é imagem sem texto extraível
      startPage: Math.max(1, Math.min(startPage, totalPages)),
      endPage: Math.max(1, Math.min(endPage, totalPages)),
    };
  }

  // Override startPage for exact anchor hymns (keep interpolated endPage)
  for (const anchor of allAnchors) {
    if (anchor.hymn >= 1 && anchor.hymn <= lastHymn && map[String(anchor.hymn)]) {
      map[String(anchor.hymn)].startPage = anchor.page;
      // Ensure endPage >= startPage
      if (map[String(anchor.hymn)].endPage < anchor.page) {
        map[String(anchor.hymn)].endPage = anchor.page;
      }
    }
  }

  // Validation & sample output
  const entries = Object.values(map).sort((a, b) => Number(a.number) - Number(b.number));
  console.log(`\nTotal de entradas no mapa: ${entries.length}`);
  console.log('\nVerificação de amostras (âncoras exatas + intermediários):');
  [1, 34, 50, 69, 80, 100, 200, 300, 422, 500, 600, 627].forEach((n) => {
    const e = map[String(n)];
    if (e) {
      const exact = allAnchors.some((a) => a.hymn === n) ? ' ★ âncora' : '';
      console.log(`  Hino ${String(n).padStart(3)}: p.${e.startPage}${exact}`);
    }
  });

  await fs.writeFile(OUTPUT, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  console.log(`\nMapa salvo em: ${path.relative(appRoot, OUTPUT)}`);
  console.log('\nNota: páginas estimadas por interpolação linear (±2 páginas de erro possível).');
  console.log('Para aumentar a precisão, adicione mais âncoras em ANCHORS no script e rode novamente.');
}

main().catch((error) => {
  console.error('\nErro durante a geração do mapa:', error);
  process.exitCode = 1;
});
