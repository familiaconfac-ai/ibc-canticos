import PdfViewer from './PdfViewer';
import { formatHymnNumber } from '../data/hymnals';

export default function HymnViewer({ hymnal, hymn, numeroNormalizado, onClose }) {
  const pageLabel =
    hymn.startPage === hymn.endPage
      ? `Página ${hymn.startPage}`
      : `Páginas ${hymn.startPage} a ${hymn.endPage}`;

  return (
    <section className="hymn-viewer-shell" aria-label="Visualizador do hino">
      <header className="hymn-viewer-header">
        <button type="button" className="viewer-back-button" onClick={onClose}>
          Voltar
        </button>

        <div className="viewer-heading">
          <span className="viewer-badge">{hymnal.label}</span>
          <h1>
            {formatHymnNumber(hymn.number)}. {hymn.title}
          </h1>
          <p>{pageLabel}</p>
        </div>
      </header>

      <PdfViewer
        pdfUrl={hymnal.pdfUrl}
        startPage={hymn.startPage}
        endPage={hymn.endPage}
        numeroNormalizado={numeroNormalizado}
        tituloEncontrado={hymn.title}
        paginaMapa={hymn.startPage}
      />
    </section>
  );
}
