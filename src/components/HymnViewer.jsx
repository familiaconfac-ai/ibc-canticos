import { useEffect, useState } from 'react';
import PdfViewer from './PdfViewer';
import { formatHymnNumber, getViewModeLabel } from '../data/hymnals';

export default function HymnViewer({ hymnal, viewMode, hymnNumber, onClose }) {
  const [resolvedHymn, setResolvedHymn] = useState(null);

  useEffect(() => {
    setResolvedHymn(null);
  }, [hymnNumber, hymnal.id, viewMode]);

  return (
    <section className="hymn-viewer-shell" aria-label="Visualizador do hino">
      <header className="hymn-viewer-header">
        <button type="button" className="viewer-back-button" onClick={onClose}>
          Voltar
        </button>

        <div className="viewer-heading">
          <div className="viewer-meta-badges">
            <span className="viewer-badge">{hymnal.label}</span>
            <span className="viewer-badge viewer-badge-muted">{getViewModeLabel(viewMode)}</span>
          </div>

          <h1>
            {formatHymnNumber(hymnNumber)}
            {resolvedHymn?.title ? `. ${resolvedHymn.title}` : ''}
          </h1>

          {resolvedHymn?.notice ? <div className="viewer-note">{resolvedHymn.notice}</div> : null}
        </div>
      </header>

      <PdfViewer
        hymnal={hymnal}
        viewMode={viewMode}
        hymnNumber={hymnNumber}
        onResolve={setResolvedHymn}
      />
    </section>
  );
}
