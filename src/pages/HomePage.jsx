import { useEffect, useState } from 'react';
import HymnViewer from '../components/HymnViewer';
import {
  getViewModeLabel,
  HYMNAL_IDS,
  HYMNALS,
  HYMNAL_OPTIONS,
  normalizeHymnNumber,
  VIEW_MODES,
  VIEW_MODE_OPTIONS,
} from '../data/hymnals';

export default function HomePage() {
  const [selectedViewMode, setSelectedViewMode] = useState(VIEW_MODES.LETRA);
  const [selectedHymnalId, setSelectedHymnalId] = useState(HYMNAL_IDS.CANTICOS);
  const [numberInput, setNumberInput] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [error, setError] = useState('');

  const selectedHymnal = HYMNALS[selectedHymnalId];

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
    const tipoSelecionado = `${getViewModeLabel(selectedViewMode)} / ${selectedHymnal.fullLabel}`;
    const numeroDigitado = numberInput;
    const pdfUrl = selectedHymnal.pdfVariants[selectedViewMode];

    console.log('tipoSelecionado:', tipoSelecionado);
    console.log('numeroDigitado:', numeroDigitado);
    console.log('numeroNormalizado:', numeroNormalizado);
    console.log('pdfUrl:', pdfUrl);

    if (!numeroNormalizado) {
      setError('Digite um número de hino válido.');
      return;
    }

    setError('');
    setSelectedRequest({
      hymnal: selectedHymnal,
      viewMode: selectedViewMode,
      hymnNumber: numeroNormalizado,
    });
  }

  if (selectedRequest) {
    return (
      <HymnViewer
        hymnal={selectedRequest.hymnal}
        viewMode={selectedRequest.viewMode}
        hymnNumber={selectedRequest.hymnNumber}
        onClose={() => setSelectedRequest(null)}
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

        </div>

        <form className="hymnal-form" onSubmit={handleOpen}>
          <fieldset className="mode-switcher" aria-label="Escolher modo de visualização">
            {VIEW_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === selectedViewMode ? 'mode-option active' : 'mode-option'}
                onClick={() => {
                  setSelectedViewMode(option.id);
                  setError('');
                }}
              >
                <span className="mode-option-label">{option.label}</span>
              </button>
            ))}
          </fieldset>

          <fieldset className="hymnal-switcher" aria-label="Escolher coleção">
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

          <input
              id="hymn-number"
              className="hymn-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="Digite o número"
              value={numberInput}
              onChange={(event) => {
                setNumberInput(event.target.value.replace(/\D/g, ''));
                setError('');
              }}
            />

          {error ? <div className="form-error" role="alert">{error}</div> : null}

          <button type="submit" className="open-button">
            ABRIR
          </button>
        </form>
      </section>
    </main>
  );
}
