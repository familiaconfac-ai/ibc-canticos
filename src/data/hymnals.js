import canticosMap from './canticosMap.json';
import hinarioCultoCristaoMap from './hinarioCultoCristaoMap.json';
import vozDeMelodiaMap from './vozDeMelodiaMap.json';

export const HYMNAL_IDS = {
  VOZ_MELODIA: 'vozMelodia',
  HINARIO_CULTO_CRISTAO: 'hinarioCultoCristao',
  CANTICOS: 'canticos',
};

function createHymnal({ id, label, fullLabel, pdfUrl, map }) {
  return {
    id,
    label,
    fullLabel,
    pdfUrl,
    map,
  };
}

export const HYMNALS = {
  [HYMNAL_IDS.VOZ_MELODIA]: createHymnal({
    id: HYMNAL_IDS.VOZ_MELODIA,
    label: 'Voz de Melodia',
    fullLabel: 'Voz de Melodia',
    pdfUrl: '/pdfs/voz-melodia.pdf',
    map: vozDeMelodiaMap,
  }),
  [HYMNAL_IDS.HINARIO_CULTO_CRISTAO]: createHymnal({
    id: HYMNAL_IDS.HINARIO_CULTO_CRISTAO,
    label: 'Hinário',
    fullLabel: 'Hinário para o Culto Cristão',
    pdfUrl: '/pdfs/hinario-culto-cristao.pdf',
    map: hinarioCultoCristaoMap,
  }),
  [HYMNAL_IDS.CANTICOS]: createHymnal({
    id: HYMNAL_IDS.CANTICOS,
    label: 'Cânticos',
    fullLabel: 'Cânticos',
    pdfUrl: '/pdfs/canticos.pdf',
    map: canticosMap,
  }),
};

export const HYMNAL_OPTIONS = [
  HYMNALS[HYMNAL_IDS.VOZ_MELODIA],
  HYMNALS[HYMNAL_IDS.HINARIO_CULTO_CRISTAO],
  HYMNALS[HYMNAL_IDS.CANTICOS],
];

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
