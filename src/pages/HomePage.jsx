import { useEffect, useRef, useState } from 'react';
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
import { searchHymnsInPdf } from '../utils/pdfHymnSearch';

export default function HomePage() {
  const [selectedViewMode, setSelectedViewMode] = useState(VIEW_MODES.LETRA);
  const [selectedHymnalId, setSelectedHymnalId] = useState(HYMNAL_IDS.CANTICOS);
  const [numberInput, setNumberInput] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const recognitionRef = useRef(null);

  const selectedHymnal = HYMNALS[selectedHymnalId];

  function getHymnalDisplayLabel(hymnal) {
    const labels = {
      [HYMNAL_IDS.CANTICOS]: 'IBC - Cânticos IBC',
      [HYMNAL_IDS.HINARIO]: 'HCC - Hinário Culto Cristão',
      [HYMNAL_IDS.VOZ_MELODIA]: 'VM - Voz de Melodia',
      [HYMNAL_IDS.CANTOR_CRISTAO]: 'CC - Cantor Cristão',
    };

    return labels[hymnal?.id] ?? `${hymnal?.label ?? ''} - ${hymnal?.fullLabel ?? ''}`.trim();
  }

  useEffect(() => {
    document.title = 'IBC Cânticos';
  }, []);

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  function clearSearchState({ keepQuery = false } = {}) {
    if (!keepQuery) {
      setSearchQuery('');
    }

    setSearchResults([]);
    setSearchError('');
    setSearching(false);
  }

  function openHymnRequest(hymnal, viewMode, hymnNumber) {
    const normalizedNumber = normalizeHymnNumber(hymnNumber);

    if (!hymnal || !normalizedNumber) {
      return false;
    }

    setSelectedRequest({
      hymnal,
      viewMode,
      hymnNumber: normalizedNumber,
    });

    return true;
  }

  async function runGlobalTextSearch(query) {
    const trimmedQuery = String(query ?? '').trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchError('Digite número, título ou trecho da letra para buscar.');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const hymnals = Object.values(HYMNALS);
      const allResults = await Promise.all(
        hymnals.map(async (hymnal) => {
          const pdfUrl = hymnal?.pdfVariants?.[VIEW_MODES.LETRA];

          if (!pdfUrl) {
            return [];
          }

          try {
            const results = await searchHymnsInPdf(pdfUrl, hymnal, trimmedQuery);

            return results.map((result) => ({
              ...result,
              hymnalId: hymnal.id,
              hymnalLabel: hymnal.label,
              hymnalFullLabel: hymnal.fullLabel,
            }));
          } catch (hymnalError) {
            console.error('Erro ao buscar no hinário:', hymnal.id, hymnalError);
            return [];
          }
        }),
      );

      const mergedResults = allResults
        .flat()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || Number(a.number) - Number(b.number))
        .slice(0, 20);

      setSearchResults(mergedResults);

      if (!mergedResults.length) {
        setSearchError('Nenhum hino encontrado para essa busca.');
      }
    } catch (searchErr) {
      console.error('Erro de busca de hinos:', searchErr);
      setSearchResults([]);
      setSearchError('Não foi possível buscar nos hinários agora.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSmartSearch(query) {
    const trimmedQuery = String(query ?? '').trim();
    const isNumericSearch = /^\d+$/.test(trimmedQuery);

    if (!trimmedQuery) {
      clearSearchState();
      setSearchError('Digite número, título ou trecho da letra para buscar.');
      return;
    }

    setSearchQuery(trimmedQuery);
    setError('');

    if (isNumericSearch) {
      clearSearchState({ keepQuery: true });
      setNumberInput(trimmedQuery);
      openHymnRequest(selectedHymnal, selectedViewMode, trimmedQuery);
      return;
    }

    await runGlobalTextSearch(trimmedQuery);
  }

  function stopRecognition() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setVoiceActive(false);
  }

  function handleVoiceClick() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSearchError('Busca por voz não está disponível neste navegador.');
      return;
    }

    if (voiceActive) {
      stopRecognition();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => {
      setVoiceActive(true);
      setSearchError('');
    };

    recognition.onresult = (event) => {
      finalTranscript = event.results?.[0]?.[0]?.transcript ?? '';
      setSearchQuery(finalTranscript);
    };

    recognition.onerror = () => {
      setSearchError('Erro no reconhecimento de voz. Tente novamente.');
    };

    recognition.onend = () => {
      setVoiceActive(false);
      recognitionRef.current = null;

      if (finalTranscript.trim()) {
        handleSmartSearch(finalTranscript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function handleSearchResultClick(result) {
    const matchedHymnal = HYMNALS[result.hymnalId];
    const normalizedNumber = normalizeHymnNumber(result.number);

    if (!matchedHymnal || !normalizedNumber) {
      setSearchError('Não foi possível abrir este hino.');
      return;
    }

    setSelectedHymnalId(result.hymnalId);
    setSelectedViewMode(VIEW_MODES.LETRA);
    setNumberInput(normalizedNumber);
    setError('');
    setSearchError('');
    openHymnRequest(matchedHymnal, VIEW_MODES.LETRA, normalizedNumber);
  }

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
    openHymnRequest(selectedHymnal, selectedViewMode, numeroNormalizado);
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
          <section className="search-block" aria-label="Buscar por texto ou voz">
            <div className="search-block-header">
              <h2 className="search-block-title">Busca por texto ou voz</h2>
              <p className="search-block-copy">Pesquisa em todos os hinários usando os PDFs de letras.</p>
            </div>

            <div className="search-input-group">
              <div className="search-input-shell">
                <input
                  id="hymn-search"
                  className="search-input"
                  type="search"
                  autoComplete="off"
                  placeholder="Digite título, número ou trecho da letra"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (!searching) {
                        handleSmartSearch(searchQuery);
                      }
                    }
                  }}
                />

                {searchQuery || searchResults.length > 0 || searchError ? (
                  <button
                    type="button"
                    className="search-clear-button"
                    onClick={() => clearSearchState()}
                    aria-label="Limpar busca"
                    title="Limpar busca"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                className={voiceActive ? 'voice-button active' : 'voice-button'}
                onClick={handleVoiceClick}
                aria-pressed={voiceActive}
                aria-label="Buscar por voz"
                title="Buscar por voz"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1.75a3 3 0 0 1 3 3v6.5a3 3 0 0 1-6 0v-6.5a3 3 0 0 1 3-3z" />
                  <path d="M19 10.25a7 7 0 0 1-14 0" />
                  <line x1="12" y1="17.75" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              </button>

              <button
                type="button"
                className="search-button"
                disabled={searching}
                onClick={() => {
                  if (!searching) {
                    handleSmartSearch(searchQuery);
                  }
                }}
              >
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {searchError ? <div className="form-error" role="alert">{searchError}</div> : null}

            {searchResults.length > 0 ? (
              <div className="search-results">
                <ul className="search-results-list">
                  {searchResults.map((result) => (
                    <li key={`${result.hymnalId}-${result.number}-${result.title || 'hymn'}`}>
                      <button
                        type="button"
                        className="search-result-item"
                        onClick={() => handleSearchResultClick(result)}
                      >
                        <div className="search-result-line">
                          <span className="search-result-hymnal">{result.hymnalLabel}</span>
                          <span className="search-result-separator">•</span>
                          <span className="search-result-number">#{result.number}</span>
                          <span className="search-result-separator">•</span>
                          <span className="search-result-title">{result.title || `Hino ${result.number}`}</span>
                        </div>
                        <p className="search-result-excerpt">{result.excerpt || ''}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

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
                <span className="hymnal-option-label">{getHymnalDisplayLabel(option)}</span>
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
