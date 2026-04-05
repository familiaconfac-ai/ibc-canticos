import canticosMap from './canticosMap.json';
import hinarioCultoCristaoMap from './hinarioCultoCristaoMap.json';
import vozDeMelodiaMap from './vozDeMelodiaMap.json';

export const HYMNAL_IDS = {
  VOZ_MELODIA: 'vozMelodia',
  HINARIO_CULTO_CRISTAO: 'hinarioCultoCristao',
  CANTICOS: 'canticos',
};

export const VIEW_MODES = {
  LETRA: 'letra',
  CIFRA: 'cifra',
  PARTITURA: 'partitura',
};

function buildPdfVariantUrl(basePdfName, viewMode) {
  if (viewMode === VIEW_MODES.CIFRA) {
    return `/pdfs/${basePdfName}-cifras.pdf`;
  }

  if (viewMode === VIEW_MODES.PARTITURA) {
    return `/pdfs/${basePdfName}-partituras.pdf`;
  }

  return `/pdfs/${basePdfName}.pdf`;
}

function createHymnal({ id, label, fullLabel, basePdfName, map, searchStrategy }) {
  return {
    id,
    label,
    fullLabel,
    basePdfName,
    pdfUrl: buildPdfVariantUrl(basePdfName, VIEW_MODES.LETRA),
    pdfVariants: {
      [VIEW_MODES.LETRA]: buildPdfVariantUrl(basePdfName, VIEW_MODES.LETRA),
      [VIEW_MODES.CIFRA]: buildPdfVariantUrl(basePdfName, VIEW_MODES.CIFRA),
      [VIEW_MODES.PARTITURA]: buildPdfVariantUrl(basePdfName, VIEW_MODES.PARTITURA),
    },
    map,
    searchStrategy,
  };
}

export const HYMNALS = {
  [HYMNAL_IDS.VOZ_MELODIA]: createHymnal({
    id: HYMNAL_IDS.VOZ_MELODIA,
    label: 'Voz de Melodia',
    fullLabel: 'Voz de Melodia',
    basePdfName: 'voz-melodia',
    map: vozDeMelodiaMap,
    searchStrategy: 'line',
  }),
  [HYMNAL_IDS.HINARIO_CULTO_CRISTAO]: createHymnal({
    id: HYMNAL_IDS.HINARIO_CULTO_CRISTAO,
    label: 'Hinário',
    fullLabel: 'Hinário para o Culto Cristão',
    basePdfName: 'hinario-culto-cristao',
    map: hinarioCultoCristaoMap,
    searchStrategy: 'map',
  }),
  [HYMNAL_IDS.CANTICOS]: createHymnal({
    id: HYMNAL_IDS.CANTICOS,
    label: 'Cânticos',
    fullLabel: 'Cânticos',
    basePdfName: 'canticos',
    map: canticosMap,
    searchStrategy: 'line',
  }),
};

export const HYMNAL_OPTIONS = [
  HYMNALS[HYMNAL_IDS.VOZ_MELODIA],
  HYMNALS[HYMNAL_IDS.HINARIO_CULTO_CRISTAO],
  HYMNALS[HYMNAL_IDS.CANTICOS],
];

export const VIEW_MODE_OPTIONS = [
  {
    id: VIEW_MODES.LETRA,
    label: 'Letra',
    description: 'PDF base da coleção',
  },
  {
    id: VIEW_MODES.CIFRA,
    label: 'Cifra',
    description: 'Sufixo -cifras',
  },
  {
    id: VIEW_MODES.PARTITURA,
    label: 'Partitura',
    description: 'Sufixo -partituras',
  },
];

export function getViewModeLabel(viewMode) {
  return VIEW_MODE_OPTIONS.find((option) => option.id === viewMode)?.label ?? 'Letra';
}

export function formatHymnNumber(value) {
  const normalized = normalizeHymnNumber(value);
  return normalized ? normalized.padStart(2, '0') : '';
}

export function normalizeHymnNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return String(Number(digits));
}

export function getHymnByNumber(hymnalId, hymnNumber) {
  const hymnal = HYMNALS[hymnalId];
  const normalizedNumber = normalizeHymnNumber(hymnNumber);

  if (!hymnal || !normalizedNumber) {
    return null;
  }

  return hymnal.map[normalizedNumber] ?? null;
}
