import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getViewModeLabel, VIEW_MODES } from '../data/hymnals';
import { findHymnBlock, getOrBuildHeadingIndex } from '../utils/pdfHymnSearch';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

function PdfPageCanvas({ pdf, pageNumber, containerWidth, clipTop = 0, clipBottom = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask;

    async function renderPage() {
      if (!pdf || !canvasRef.current || !containerWidth) {
        return;
      }

      const page = await pdf.getPage(pageNumber);

      if (cancelled || !canvasRef.current) {
        return;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;
      const scaledClipTop = Math.max(0, clipTop * scale);
      const scaledClipBottom = Math.max(0, clipBottom * scale);
      const visibleHeight = Math.max(1, viewport.height - scaledClipTop - scaledClipBottom);
      const sourceOffsetY = Math.max(0, Math.floor(scaledClipTop * outputScale));
      const scratchCanvas = document.createElement('canvas');
      const scratchContext = scratchCanvas.getContext('2d');

      if (!scratchContext) {
        throw new Error(`Canvas 2D context unavailable for page ${pageNumber}.`);
      }

      scratchCanvas.width = Math.floor(viewport.width * outputScale);
      scratchCanvas.height = Math.floor(viewport.height * outputScale);
      scratchContext.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      scratchContext.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);

      renderTask = page.render({
        canvasContext: scratchContext,
        viewport,
      });

      await renderTask.promise;

      if (cancelled || !canvasRef.current) {
        return;
      }

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error(`Canvas 2D context unavailable for page ${pageNumber}.`);
      }

      const sourceHeight = Math.max(
        1,
        Math.min(scratchCanvas.height - sourceOffsetY, Math.floor(visibleHeight * outputScale)),
      );

      canvas.width = scratchCanvas.width;
      canvas.height = sourceHeight;
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(visibleHeight)}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        scratchCanvas,
        0,
        sourceOffsetY,
        scratchCanvas.width,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      console.log('paginaRenderizada:', pageNumber);
    }

    renderPage().catch((error) => {
      if (import.meta.env.DEV) {
        console.error('Erro ao renderizar página do PDF:', pageNumber, error);
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [clipBottom, clipTop, containerWidth, pageNumber, pdf]);

  return <canvas ref={canvasRef} className="pdf-page-canvas" />;
}

async function loadPdfDocument(url) {
  return pdfjs.getDocument({ url }).promise;
}

export default function PdfViewer({ hymnal, viewMode, hymnNumber, onResolve }) {
  const containerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hymnBlock, setHymnBlock] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const pages = useMemo(() => hymnBlock?.segments ?? [], [hymnBlock]);

  useEffect(() => {
    let active = true;
    let loadedDocument = null;

    setPdf(null);
    setError('');
    setNotice('');
    setHymnBlock(null);
    onResolve?.(null);

    async function loadHymn() {
      const requestedUrl = hymnal.pdfVariants[viewMode];
      const baseUrl = hymnal.pdfVariants[VIEW_MODES.LETRA];
      let resolvedUrl = requestedUrl;
      let resolvedDocument = null;
      let fallbackNotice = '';

      try {
        resolvedDocument = await loadPdfDocument(requestedUrl);
      } catch (loadError) {
        if (viewMode === VIEW_MODES.LETRA) {
          throw loadError;
        }

        resolvedUrl = baseUrl;
        fallbackNotice = `O PDF de ${getViewModeLabel(viewMode).toLowerCase()} ainda não foi adicionado para ${hymnal.label}. Exibindo a versão de letra.`;
        resolvedDocument = await loadPdfDocument(baseUrl);
      }

      loadedDocument = resolvedDocument;

      const headingIndex = await getOrBuildHeadingIndex(
        resolvedUrl,
        resolvedDocument,
        hymnal.searchStrategy,
      );
      const resolvedHymn = findHymnBlock(headingIndex, hymnNumber);

      if (!resolvedHymn) {
        throw new Error(`Hino ${hymnNumber} não encontrado em ${hymnal.fullLabel}.`);
      }

      if (!active) {
        resolvedDocument.destroy();
        return;
      }

      console.log('numeroNormalizado:', hymnNumber);
      console.log('pdfUrl:', resolvedUrl);
      console.log('tituloEncontrado:', resolvedHymn.title);
      console.log('paginaMapa:', resolvedHymn.startPage);

      setNotice(fallbackNotice);
      setPdf(resolvedDocument);
      setHymnBlock(resolvedHymn);
      onResolve?.({
        ...resolvedHymn,
        notice: fallbackNotice,
        pdfUrl: resolvedUrl,
      });
    }

    loadHymn().catch((loadError) => {
      if (!active) {
        return;
      }

      if (import.meta.env.DEV) {
        console.error('Erro ao localizar hino no PDF:', hymnal.id, viewMode, hymnNumber, loadError);
      }

      onResolve?.(null);
      setError(loadError?.message || 'Não consegui abrir esse hino.');
    });

    return () => {
      active = false;
      loadedDocument?.destroy();
    };
  }, [hymnNumber, hymnal, onResolve, viewMode]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const updateContainerWidth = () => {
      if (!containerRef.current) {
        return;
      }

      setContainerWidth(Math.max(280, Math.floor(containerRef.current.getBoundingClientRect().width)));
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    const visualViewport = window.visualViewport;

    resizeObserver.observe(containerRef.current);
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth, { passive: true });
    window.addEventListener('orientationchange', updateContainerWidth, { passive: true });
    visualViewport?.addEventListener('resize', updateContainerWidth, { passive: true });
    visualViewport?.addEventListener('scroll', updateContainerWidth, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateContainerWidth);
      window.removeEventListener('orientationchange', updateContainerWidth);
      visualViewport?.removeEventListener('resize', updateContainerWidth);
      visualViewport?.removeEventListener('scroll', updateContainerWidth);
    };
  }, [pdf]);

  if (error) {
    return <div className="pdf-feedback pdf-feedback-error">{error}</div>;
  }

  if (!pdf || !hymnBlock) {
    return <div className="pdf-feedback">Carregando hino...</div>;
  }

  return (
    <div className="pdf-viewer" ref={containerRef}>
      {notice ? <div className="pdf-feedback pdf-feedback-note">{notice}</div> : null}

      <div className="pdf-status">
        <span>
          {pages.length === 1
            ? '1 trecho do hino carregado'
            : `${pages.length} trechos do hino carregados`}
        </span>
      </div>

      <div className="pdf-pages">
        {pages.map((segment) => (
          <article key={`${segment.pageNumber}-${segment.clipTop}-${segment.clipBottom}`} className="pdf-page-card">
            <div className="pdf-page-label">Página {segment.pageNumber}</div>
            <PdfPageCanvas
              pdf={pdf}
              pageNumber={segment.pageNumber}
              containerWidth={containerWidth}
              clipTop={segment.clipTop}
              clipBottom={segment.clipBottom}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
