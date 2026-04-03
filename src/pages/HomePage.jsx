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
  const [selectedHymnalId, setSelectedHymnalId] = useState(HYMNAL_IDS.VOZ_MELODIA);
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

          <div className="home-intro">
            <p className="home-lead">
              Escolha o modo, a coleção e o número do hino para abrir somente o trecho certo do PDF.
            </p>
          </div>
        </div>

        <form className="hymnal-form" onSubmit={handleOpen}>
          <div className="form-section">
            <div className="section-heading">
              <span className="section-step">1</span>
              <div>
                <h2>Modo de visualização</h2>
                <p>Letra usa o PDF base. Cifra e Partitura seguem a convenção automática de nome.</p>
              </div>
            </div>

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
                  <span className="mode-option-subtitle">{option.description}</span>
                </button>
              ))}
            </fieldset>
          </div>

          <div className="form-section">
            <div className="section-heading">
              <span className="section-step">2</span>
              <div>
                <h2>Escolha a coleção</h2>
                <p>O app aplica o modo selecionado sobre a coleção escolhida.</p>
              </div>
            </div>

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
          </div>

          <div className="form-section">
            <div className="section-heading">
              <span className="section-step">3</span>
              <div>
                <h2>Digite o número</h2>
                <p>O app localiza o início real do hino e recorta apenas o bloco correspondente.</p>
              </div>
            </div>

            <input
              id="hymn-number"
              className="hymn-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="320"
              value={numberInput}
              onChange={(event) => {
                setNumberInput(event.target.value.replace(/\D/g, ''));
                setError('');
              }}
            />
          </div>

          {error ? <div className="form-error" role="alert">{error}</div> : null}

          <button type="submit" className="open-button">
            Abrir hino
          </button>
        </form>
      </section>
    </main>
  );
}
