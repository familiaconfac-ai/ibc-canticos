import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const headingIndexCache = new Map();
const pageOffsetCache = new Map();
const pageTextCache = new Map();

const START_PADDING = 12;
const NEXT_HEADING_PADDING = 14;
const MIN_VISIBLE_HEIGHT = 1;

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeHeadingLine(line) {
  return normalizeText(line).replace(/[\u2013\u2014]/g, '-');
}

function normalizeRuntimeNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? String(Number(digits)) : '';
}

function buildExcerpt(text, query, maxLength = 160) {
  const cleanText = normalizeText(text);
  const normalizedText = normalizeSearchText(cleanText);
  const normalizedQuery = normalizeSearchText(query);

  if (!cleanText) {
    return '';
  }

  if (!normalizedQuery) {
    return cleanText.slice(0, maxLength);
  }

  const matchIndex = normalizedText.indexOf(normalizedQuery);

  if (matchIndex < 0) {
    return cleanText.length > maxLength
      ? `${cleanText.slice(0, maxLength).trim()}...`
      : cleanText;
  }

  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(cleanText.length, matchIndex + normalizedQuery.length + 80);
  const excerpt = cleanText.slice(start, end).trim();

  return `${start > 0 ? '...' : ''}${excerpt}${end < cleanText.length ? '...' : ''}`;
}

async function loadPdfPageTexts(pdfUrl) {
  if (pageTextCache.has(pdfUrl)) {
    return pageTextCache.get(pdfUrl);
  }

  const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false, useWorkerFetch: false });
  const document = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = normalizeText(textContent.items.map((item) => item.str ?? '').join(' '));

    pages.push({
      pageNumber,
      text,
      normalizedText: normalizeSearchText(text),
    });
  }

  document.destroy();
  pageTextCache.set(pdfUrl, pages);
  return pages;
}

function getMappedEntries(hymnal) {
  const map = hymnal?.map;

  if (!map || typeof map !== 'object') {
    return [];
  }

  return Object.values(map);
}

function extractPossibleNumber(text) {
  const match =
    normalizeText(text).match(/\b(?:hino\s*)?0*(\d{1,3})\b/i);

  return match?.[1] ? String(Number(match[1])) : '';
}

function extractPossibleTitle(text) {
  const lines = String(text ?? '')
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  return lines.find((line) => /[A-Za-zÀ-ÿ]/.test(line) && line.length >= 4) ?? '';
}

function getHeadingMatcher(line) {
  return normalizeHeadingLine(line).match(
    /^(?:HINO\s*)?0*(\d{1,3})(?:\s*E\s*0*(\d{1,3}))?\s*(?:[-.:]\s*|\s+)(.+)$/i,
  );
}

function buildLineEntries(items, pageHeight) {
  const groups = new Map();

  for (const item of items) {
    const text = item.str ?? '';

    if (!text.trim()) {
      continue;
    }

    const y = Math.round(item.transform[5] * 10) / 10;
    const line = groups.get(y) ?? [];

    line.push({
      text,
      x: item.transform[4],
      width: item.width ?? 0,
      height: item.height || Math.abs(item.transform[3]) || 0,
    });

    groups.set(y, line);
  }

  return [...groups.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([y, line]) => {
      const sortedLine = line.sort((left, right) => left.x - right.x);
      const minX = sortedLine.length ? Math.min(...sortedLine.map((item) => item.x)) : 0;
      const maxX = sortedLine.length
        ? Math.max(...sortedLine.map((item) => item.x + item.width))
        : minX;
      const height = sortedLine.length ? Math.max(...sortedLine.map((item) => item.height || 0)) : 0;
      const top = Math.max(0, pageHeight - (y + height));
      const bottom = Math.min(pageHeight, pageHeight - y);

      return {
        text: normalizeText(sortedLine.map((item) => item.text).join(' ')),
        y,
        minX,
        maxX,
        height,
        top,
        bottom,
      };
    })
    .filter((line) => line.text);
}

function buildTextItems(items, pageHeight) {
  return items
    .map((item) => {
      const text = normalizeText(item.str ?? '');
      const height = item.height || Math.abs(item.transform[3]) || 0;
      const y = item.transform[5];
      const top = Math.max(0, pageHeight - (y + height));
      const bottom = Math.min(pageHeight, pageHeight - y);

      return {
        text,
        x: item.transform[4],
        y,
        width: item.width ?? 0,
        height,
        top,
        bottom,
        scaleX: Math.abs(item.transform[0]),
        scaleY: Math.abs(item.transform[3]),
      };
    })
    .filter((item) => item.text);
}

function getLineHeadingEntries(lines, pageNumber, pageHeight) {
  const headings = [];

  lines.forEach((line) => {
    const match = getHeadingMatcher(line.text);

    if (!match) {
      return;
    }

    const [, firstNumber, secondNumber, title] = match;
    const lineKey = `${pageNumber}:${Math.round(line.y)}:${Math.round(line.minX)}`;
    const baseHeading = {
      title: normalizeText(title),
      pageNumber,
      pageHeight,
      top: line.top,
      bottom: line.bottom,
      x: line.minX,
      y: line.y,
      lineKey,
    };

    headings.push({
      ...baseHeading,
      number: String(Number(firstNumber)),
    });

    if (secondNumber) {
      headings.push({
        ...baseHeading,
        number: String(Number(secondNumber)),
      });
    }
  });

  return headings;
}

function isStructuredTitleCandidate(item) {
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

function findNearbyStructuredNumber(items, titleItem) {
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

  return numberCandidates
    .sort((left, right) => {
      const leftDistance = Math.abs(left.x - titleItem.x);
      const rightDistance = Math.abs(right.x - titleItem.x);
      return leftDistance - rightDistance || right.x - left.x;
    })
    .at(0);
}

function getStructuredHeadingEntries(items, pageNumber, pageHeight) {
  return items
    .filter(isStructuredTitleCandidate)
    .map((titleItem) => {
      const numberItem = findNearbyStructuredNumber(items, titleItem);

      if (!numberItem) {
        return null;
      }

      const top = Math.max(0, Math.min(titleItem.top, numberItem.top));
      const bottom = Math.min(pageHeight, Math.max(titleItem.bottom, numberItem.bottom));

      return {
        number: String(Number(numberItem.text)),
        title: titleItem.text,
        pageNumber,
        pageHeight,
        top,
        bottom,
        x: Math.min(titleItem.x, numberItem.x),
        y: Math.max(titleItem.y, numberItem.y),
        lineKey: `${pageNumber}:${Math.round(top)}:${Math.round(Math.min(titleItem.x, numberItem.x))}`,
      };
    })
    .filter(Boolean);
}

function sortHeadings(headings) {
  return [...headings].sort((left, right) => {
    return left.pageNumber - right.pageNumber || left.top - right.top || left.x - right.x;
  });
}

async function buildHeadingIndex(document, strategy) {
  const pageHeights = {};
  const headings = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    pageHeights[pageNumber] = viewport.height;

    if (strategy === 'structured') {
      headings.push(...getStructuredHeadingEntries(buildTextItems(textContent.items, viewport.height), pageNumber, viewport.height));
      continue;
    }

    headings.push(...getLineHeadingEntries(buildLineEntries(textContent.items, viewport.height), pageNumber, viewport.height));
  }

  return {
    numPages: document.numPages,
    pageHeights,
    headings: sortHeadings(headings),
  };
}

export async function getOrBuildHeadingIndex(cacheKey, document, strategy) {
  const safeCacheKey = `${strategy}:${cacheKey}`;

  if (!headingIndexCache.has(safeCacheKey)) {
    headingIndexCache.set(safeCacheKey, buildHeadingIndex(document, strategy));
  }

  return headingIndexCache.get(safeCacheKey);
}

function getNextDistinctHeading(headings, startIndex) {
  const currentHeading = headings[startIndex];

  for (let index = startIndex + 1; index < headings.length; index += 1) {
    const candidate = headings[index];

    if (candidate.lineKey !== currentHeading.lineKey) {
      return candidate;
    }
  }

  return null;
}

export function findHymnBlock(index, hymnNumber) {
  const normalizedNumber = normalizeRuntimeNumber(hymnNumber);

  if (!normalizedNumber) {
    return null;
  }

  const targetIndex = index.headings.findIndex((heading) => heading.number === normalizedNumber);

  if (targetIndex < 0) {
    return null;
  }

  const targetHeading = index.headings[targetIndex];
  const nextHeading = getNextDistinctHeading(index.headings, targetIndex);

  const lastPage = nextHeading ? nextHeading.pageNumber : index.numPages;

  // When the next hymn heading is detected on the SAME page as this hymn,
  // the hymn ends within that page. We do NOT extend to the following page.
  // We also skip the clipBottom in this case: the padding heuristic alone was
  // cutting the last line of the current hymn. Showing the rest of the page
  // (which may include a small sliver of the next hymn's heading) is preferable
  // to cutting content prematurely.
  const samePageCollision =
    nextHeading != null && nextHeading.pageNumber === targetHeading.pageNumber;

  const segments = [];

  for (let pageNumber = targetHeading.pageNumber; pageNumber <= lastPage; pageNumber += 1) {
    const pageHeight = index.pageHeights[pageNumber];
    let clipTop = 0;
    let clipBottom = 0;

    if (pageNumber === targetHeading.pageNumber) {
      clipTop = Math.max(0, targetHeading.top - START_PADDING);
    }

    // Apply bottom clip only when the next heading is on a different page.
    // In same-page collisions the clip is intentionally omitted (see above).
    if (!samePageCollision && nextHeading && pageNumber === nextHeading.pageNumber) {
      const endTop = Math.max(0, nextHeading.top - NEXT_HEADING_PADDING);
      clipBottom = Math.max(0, pageHeight - endTop);
    }

    const visibleHeight = pageHeight - clipTop - clipBottom;

    if (visibleHeight >= MIN_VISIBLE_HEIGHT) {
      segments.push({
        pageNumber,
        clipTop,
        clipBottom,
      });
    }
  }

  if (import.meta.env.DEV) {
    console.log(
      `[findHymnBlock] #${normalizedNumber}: target p${targetHeading.pageNumber} | next ${nextHeading?.number ?? '—'} p${nextHeading?.pageNumber ?? '—'} | samePageCollision=${samePageCollision} | lastPage=${lastPage} | segments=[${segments.map((s) => `p${s.pageNumber}(top=${s.clipTop.toFixed(0)},bot=${s.clipBottom.toFixed(0)})`).join(', ')}]`,
    );
  }

  if (!segments.length) {
    return null;
  }

  return {
    number: targetHeading.number,
    title: targetHeading.title,
    startPage: segments[0].pageNumber,
    endPage: segments.at(-1).pageNumber,
    segments,
  };
}

/**
 * Resolves a hymn block directly from a pre-built JSON map (strategy: 'map').
 * Each map entry must have { startPage, endPage, title }.
 * No PDF text scanning is performed.
 */
export function findHymnBlockFromMap(hymnMap, hymnNumber) {
  const digits = String(hymnNumber ?? '').replace(/\D/g, '');
  const normalizedNumber = digits ? String(Number(digits)) : '';

  if (!normalizedNumber) {
    return null;
  }

  const entry = hymnMap[normalizedNumber];

  if (!entry) {
    return null;
  }

  const segments = [];

  for (let page = entry.startPage; page <= entry.endPage; page += 1) {
    segments.push({ pageNumber: page, clipTop: 0, clipBottom: 0 });
  }

  if (!segments.length) {
    return null;
  }

  return {
    number: normalizedNumber,
    title: entry.title ?? '',
    startPage: entry.startPage,
    endPage: entry.endPage,
    segments,
  };
}

/**
 * Scans the first pages of a document (up to 40) using the 'line' heading
 * strategy to find on which page hymn number 1 begins.
 * Returns offset = (pageOfHymn1 - 1), or 0 if hymn 1 is not detected.
 */
async function detectPageOffset(document) {
  const limit = Math.min(40, document.numPages);

  for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const entries = getLineHeadingEntries(
      buildLineEntries(textContent.items, viewport.height),
      pageNumber,
      viewport.height,
    );

    if (entries.some((entry) => entry.number === '1')) {
      return pageNumber - 1;
    }
  }

  return 0;
}

/**
 * Resolves a hymn block using a direct page calculation (strategy: 'page').
 * The page offset (number of intro pages before hymn 1) is auto-detected once
 * per document by scanning for the heading of hymn 1, then cached.
 *
 * page = hymnNumber + offset
 *
 * Assumes one hymn per page in the reorganized PDF.
 */
export async function findHymnBlockByPage(cacheKey, document, hymnNumber) {
  const digits = String(hymnNumber ?? '').replace(/\D/g, '');
  const num = digits ? Number(digits) : 0;

  if (!num) {
    return null;
  }

  if (!pageOffsetCache.has(cacheKey)) {
    pageOffsetCache.set(cacheKey, detectPageOffset(document));
  }

  const offset = await pageOffsetCache.get(cacheKey);
  const targetPage = num + offset;

  if (targetPage < 1 || targetPage > document.numPages) {
    return null;
  }

  return {
    number: String(num),
    title: '',
    startPage: targetPage,
    endPage: targetPage,
    segments: [{ pageNumber: targetPage, clipTop: 0, clipBottom: 0 }],
  };
}

export async function searchHymnsInPdf(pdfUrl, hymnal, query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!pdfUrl || !normalizedQuery) {
    return [];
  }

  const pageTexts = await loadPdfPageTexts(pdfUrl);
  const mappedEntries = getMappedEntries(hymnal);
  const candidateEntries = mappedEntries.length > 0
    ? mappedEntries
    : pageTexts.map((page) => ({
      number: extractPossibleNumber(page.text) || String(page.pageNumber),
      title: extractPossibleTitle(page.text),
      startPage: page.pageNumber,
      endPage: page.pageNumber,
    }));

  const results = candidateEntries
    .map((entry) => {
      const number = normalizeRuntimeNumber(entry?.number);
      const title = normalizeText(entry?.title ?? '');
      const startPage = Number(entry?.startPage ?? entry?.page ?? 0);
      const endPage = Number(entry?.endPage ?? startPage);

      if (!number || !startPage || !endPage) {
        return null;
      }

      const hymnPages = pageTexts.filter(
        (page) => page.pageNumber >= startPage && page.pageNumber <= endPage,
      );
      const fullText = normalizeText(hymnPages.map((page) => page.text).join(' '));
      const normalizedTitle = normalizeSearchText(title);
      const normalizedNumber = normalizeSearchText(number);
      const normalizedFullText = normalizeSearchText(fullText);
      const matches =
        normalizedNumber.includes(normalizedQuery) ||
        normalizedTitle.includes(normalizedQuery) ||
        normalizedFullText.includes(normalizedQuery);

      if (!matches) {
        return null;
      }

      return {
        number,
        title: title || extractPossibleTitle(fullText) || `Hino ${number}`,
        excerpt: buildExcerpt(fullText, query),
        page: startPage,
        startPage,
        endPage,
        score:
          (normalizedNumber === normalizedQuery ? 120 : 0) +
          (normalizedTitle.includes(normalizedQuery) ? 80 : 0) +
          (normalizedFullText.includes(normalizedQuery) ? 40 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || Number(a.number) - Number(b.number))
    .slice(0, 20);

  return results;
}
