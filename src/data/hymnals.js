import canticosMap from './canticosMap.json';
import hinarioCultoCristaoMap from './hinarioCultoCristaoMap.json';
import vozDeMelodiaMap from './vozDeMelodiaMap.json';
import cantorCristaoMap from './cantorCristaoMap.json';

export const HYMNAL_IDS = {
  CANTICOS: 'canticos',
  HINARIO: 'hinario',
  VOZ_MELODIA: 'vozMelodia',
  CANTOR_CRISTAO: 'cantorCristao',
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
    return `/pdfs/${basePdfName}-partitura.pdf`;
  }

  return `/pdfs/${basePdfName}-letras.pdf`;
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
  [HYMNAL_IDS.CANTICOS]: createHymnal({
    id: HYMNAL_IDS.CANTICOS,
    label: 'IBC',
    fullLabel: 'Cânticos',
    basePdfName: 'canticos',
    map: canticosMap,
    searchStrategy: 'line',
  }),
  [HYMNAL_IDS.HINARIO]: createHymnal({
    id: HYMNAL_IDS.HINARIO,
    label: 'HCC',
    fullLabel: 'Hinário',
    basePdfName: 'hinario',
    map: hinarioCultoCristaoMap,
    searchStrategy: 'map',
  }),
  [HYMNAL_IDS.VOZ_MELODIA]: createHymnal({
    id: HYMNAL_IDS.VOZ_MELODIA,
    label: 'VM',
    fullLabel: 'Voz da Melodia',
    basePdfName: 'voz-melodia',
    map: vozDeMelodiaMap,
    searchStrategy: 'line',
  }),
  [HYMNAL_IDS.CANTOR_CRISTAO]: createHymnal({
    id: HYMNAL_IDS.CANTOR_CRISTAO,
    label: 'CC',
    fullLabel: 'Cantor Cristão',
    basePdfName: 'cantor-cristao',
    map: cantorCristaoMap,
    searchStrategy: 'line',
  }),
};

export const HYMNAL_OPTIONS = [
  HYMNALS[HYMNAL_IDS.CANTICOS],
  HYMNALS[HYMNAL_IDS.HINARIO],
  HYMNALS[HYMNAL_IDS.VOZ_MELODIA],
  HYMNALS[HYMNAL_IDS.CANTOR_CRISTAO],
];

export const VIEW_MODE_OPTIONS = [
  {
    id: VIEW_MODES.LETRA,
    label: 'Letras',
    description: 'PDF de letras',
  },
  {
    id: VIEW_MODES.CIFRA,
    label: 'Cifras',
    description: 'PDF com cifras',
  },
  {
    id: VIEW_MODES.PARTITURA,
    label: 'Partitura',
    description: 'PDF com partitura',
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
