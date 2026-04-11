import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const standardFontDataUrl = new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).href;

const SOURCES = [
  {
    input: path.join(appRoot, 'public', 'pdfs', 'voz-melodia-letras.pdf'),
    output: path.join(appRoot, 'src', 'data', 'vozDeMelodiaMap.json'),
    extractor: extractLineBasedMap,
  },
  {
    input: path.join(appRoot, 'public', 'pdfs', 'hinario-letras.pdf'),
    output: path.join(appRoot, 'src', 'data', 'hinarioCultoCristaoMap.json'),
    extractor: extractLineBasedMap,
  },
  {
    input: path.join(appRoot, 'public', 'pdfs', 'canticos-letras.pdf'),
    output: path.join(appRoot, 'src', 'data', 'canticosMap.json'),
    extractor: extractLineBasedMap,
  },
];

const HINARIO_MANUAL_OVERRIDES = {
  3: {
    number: '3',
    title: 'Isaías 6.1-4',
    startPage: 20,
    endPage: 20,
  },
  7: {
    number: '7',
    title: 'Só tu és Deus',
    startPage: 22,
    endPage: 22,
  },
  12: {
    number: '12',
    title: 'Deus é fiel, justo e reto',
    startPage: 27,
    endPage: 27,
  },
};

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeHeadingLine(line) {
  return normalizeText(line).replace(/[\u2013\u2014]/g, '-');
}

function buildLines(items) {
  const groups = new Map();

  for (const item of items) {
    const text = item.str ?? '';

    if (!text.trim()) {
      continue;
    }

    const y = Math.round(item.transform[5] * 10) / 10;
    const line = groups.get(y) ?? [];
    line.push({ x: item.transform[4], text });
    groups.set(y, line);
  }

  return [...groups.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([y, line]) => ({
      y,
      x: line.length ? Math.min(...line.map((item) => item.x)) : 0,
      text: normalizeText(
        line.sort((left, right) => left.x - right.x).map((item) => item.text).join(' '),
      ),
    }))
    .filter((line) => line.text);
}

function buildTextItems(items) {
  return items
    .map((item) => ({
      text: normalizeText(item.str ?? ''),
      x: item.transform[4],
      y: item.transform[5],
      scaleX: Math.abs(item.transform[0]),
      scaleY: Math.abs(item.transform[3]),
    }))
    .filter((item) => item.text);
}

function getLineHeadingEntries(line) {
  const normalizedLine = normalizeHeadingLine(line);
  const match = normalizedLine.match(
    /^(?:HINO\s*)?0*(\d{1,3})(?:\s*E\s*0*(\d{1,3}))?\s*(?:-|\.|:)\s*(.+)$/i,
  );

  if (!match) {
    return [];
  }

  const [, firstNumber, secondNumber, title] = match;
  const entries = [
    {
      number: String(Number(firstNumber)),
      title: normalizeText(title),
    },
  ];

  if (secondNumber) {
    entries.push({
      number: String(Number(secondNumber)),
      title: normalizeText(title),
    });
  }

  return entries;
}

function isCandidateHinarioTitle(item) {
  if (item.y < 140) {
    return false;
  }

  if (item.scaleX < 13 && item.scaleY < 13) {
    return false;
  }

  if (!/[A-Za-zÀ-ÿ]/.test(item.text)) {
    return false;
  }

  if (item.text === item.text.toUpperCase()) {
    return false;
  }

  return item.text.length >= 4;
}

function findNearbyHinarioNumber(items, titleItem) {
  const numberCandidates = items.filter((item) => {
    if (!/^\d{1,3}$/.test(item.text)) {
      return false;
    }

    if (item.scaleX < 18 && item.scaleY < 18) {
      return false;
    }

    return Math.abs(item.y - titleItem.y) <= 18;
  });

  if (!numberCandidates.length) {
    return null;
  }

  const sortedCandidates = numberCandidates.sort((left, right) => {
    const leftDistance = Math.abs(left.x - titleItem.x);
    const rightDistance = Math.abs(right.x - titleItem.x);
    return leftDistance - rightDistance || right.x - left.x;
  });

  return String(Number(sortedCandidates[0].text));
}

function buildMapFromHeadings(headings, totalPages) {
  const map = {};
  const sortedHeadings = [...headings].sort((left, right) => {
    return left.startPage - right.startPage || right.y - left.y || left.x - right.x;
  });

  sortedHeadings.forEach((heading, index) => {
    const nextHeading = sortedHeadings[index + 1];
    const endPage = nextHeading
      ? Math.max(heading.startPage, nextHeading.startPage - 1)
      : totalPages;

    map[heading.number] = {
      number: heading.number,
      title: heading.title,
      startPage: heading.startPage,
      endPage,
    };
  });

  return map;
}

async function loadDocument(filePath) {
  const data = new Uint8Array(await fs.readFile(filePath));
  return pdfjs.getDocument({ data, standardFontDataUrl }).promise;
}

async function extractLineBasedMap(document) {
  const headings = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = buildLines(textContent.items);

    for (const line of lines) {
      const entries = getLineHeadingEntries(line.text);

      entries.forEach((entry) => {
        headings.push({
          ...entry,
          startPage: pageNumber,
          x: line.x,
          y: line.y,
        });
      });
    }
  }

  return buildMapFromHeadings(headings, document.numPages);
}

async function extractHinarioCultoCristaoMap(document) {
  const headings = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = buildTextItems(textContent.items);

    items
      .filter(isCandidateHinarioTitle)
      .forEach((titleItem) => {
        const number = findNearbyHinarioNumber(items, titleItem);

        if (!number) {
          return;
        }

        headings.push({
          number,
          title: titleItem.text,
          startPage: pageNumber,
          x: titleItem.x,
          y: titleItem.y,
        });
      });
  }

  const map = buildMapFromHeadings(headings, document.numPages);

  Object.entries(HINARIO_MANUAL_OVERRIDES).forEach(([key, value]) => {
    map[key] = value;
  });

  return map;
}

async function main() {
  for (const source of SOURCES) {
    const document = await loadDocument(source.input);
    const map = await source.extractor(document);
    await document.destroy();
    await fs.writeFile(source.output, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
    console.log(`Mapa gerado: ${path.basename(source.output)} (${Object.keys(map).length} entradas)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
