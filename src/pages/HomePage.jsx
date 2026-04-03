import { useEffect, useMemo, useState } from 'react';
import HymnViewer from '../components/HymnViewer';
import {
  getHymnByNumber,
  HYMNAL_IDS,
  HYMNALS,
  HYMNAL_OPTIONS,
  normalizeHymnNumber,
} from '../data/hymnals';

const FULL_DISPLAY_LABELS = {
  [HYMNAL_IDS.VOZ_MELODIA]: 'Voz de Melodia',
  [HYMNAL_IDS.HINARIO_CULTO_CRISTAO]: 'Hinário para o Culto Cristão',
  [HYMNAL_IDS.CANTICOS]: 'Cânticos avulsos',
};

export default function HomePage() {
  const [selectedHymnalId, setSelectedHymnalId] = useState(HYMNAL_IDS.VOZ_MELODIA);
  const [numberInput, setNumberInput] = useState('');
  const [selectedHymn, setSelectedHymn] = useState(null);
  const [error, setError] = useState('');

  const selectedHymnal = HYMNALS[selectedHymnalId];
  const hymnCount = useMemo(() => Object.keys(selectedHymnal.map).length, [selectedHymnal]);

  useEffect(() => {
    document.title = 'IBC Cânticos';
  }, []);

  function handleOpen(event) {
    event.preventDefault();

    if (!numberInput.trim()) {
      setError('Digite o número do hino no campo acima.');
      return;
    }

    const numeroNormalizado = normalizeHymnNumber(numberInput);
    const hymn = getHymnByNumber(selectedHymnalId, numeroNormalizado);
    const tipoSelecionado = selectedHymnal.fullLabel;
    const numeroDigitado = numberInput;
    const pdfUrl = selectedHymnal.pdfUrl;
    const tituloEncontrado = hymn?.title ?? null;
    const paginaMapa = hymn?.startPage ?? null;

    console.log('tipoSelecionado:', tipoSelecionado);
    console.log('numeroDigitado:', numeroDigitado);
    console.log('numeroNormalizado:', numeroNormalizado);
    console.log('pdfUrl:', pdfUrl);
    console.log('tituloEncontrado:', tituloEncontrado);
    console.log('paginaMapa:', paginaMapa);

    if (!hymn) {
      setError(`Hino ${numberInput} não encontrado em ${selectedHymnal.label}.`);
      setSelectedHymn(null);
      return;
    }

    setError('');
    setSelectedHymn({
      hymnal: selectedHymnal,
      hymn,
      numeroNormalizado,
    });
  }

  if (selectedHymn) {
    return (
      <HymnViewer
        hymnal={selectedHymn.hymnal}
        hymn={selectedHymn.hymn}
        numeroNormalizado={selectedHymn.numeroNormalizado}
        onClose={() => setSelectedHymn(null)}
      />
    );
  }

  return (
    <main className="home-shell">
      <section className="home-card">
        <div className="home-header">
          <div className="home-brand">
            <img src="/logo.png" alt="Cânticos" className="home-logo" />
            <div className="home-brand-copy">
              <span className="home-kicker">Igreja Batista Central</span>
              <h1 className="home-title">CÂNTICOS</h1>
            </div>
          </div>

          <div className="home-intro">
            <p className="home-lead">
              Escolha o Hinário e digite o número para abrir o cântico.
            </p>
            <div className="home-meta">
              <span className="meta-pill">{FULL_DISPLAY_LABELS[selectedHymnalId]} | {hymnCount} Entradas</span>
            </div>
          </div>
        </div>

        <form className="hymnal-form" onSubmit={handleOpen}>
          <div className="form-section">
            <div className="section-heading">
              <span className="section-step">1</span>
              <div>
                <h2>Escolha o Hinário</h2>
              </div>
            </div>

            <fieldset className="hymnal-switcher" aria-label="Escolher hinário">
              {HYMNAL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === selectedHymnalId ? 'hymnal-option active' : 'hymnal-option'}
                  onClick={() => {
                    setSelectedHymnalId(option.id);
                    setError('');
                  }}
                >
                  <span className="hymnal-option-label">{option.label}</span>
                </button>
              ))}
            </fieldset>
          </div>

          <div className="form-section">
            <div className="section-heading">
              <span className="section-step">2</span>
              <div>
                <h2>Digite o Número</h2>
              </div>
            </div>

            <input
              id="hymn-number"
              className="hymn-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="01"
              value={numberInput}
              onChange={(event) => {
                setNumberInput(event.target.value.replace(/\D/g, ''));
                setError('');
              }}
            />

          </div>

          {error ? <div className="form-error" role="alert">{error}</div> : null}

          <button type="submit" className="open-button">
            Abrir em Tela Cheia
          </button>
        </form>
      </section>
    </main>
  );
}
