import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

function PdfPageCanvas({ pdf, pageNumber, containerWidth }) {
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
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error(`Canvas 2D context unavailable for page ${pageNumber}.`);
      }

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      await renderTask.promise;
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
  }, [containerWidth, pageNumber, pdf]);

  return <canvas ref={canvasRef} className="pdf-page-canvas" />;
}

export default function PdfViewer({
  pdfUrl,
  startPage,
  endPage,
  numeroNormalizado,
  tituloEncontrado,
  paginaMapa,
}) {
  const containerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');
  const [containerWidth, setContainerWidth] = useState(0);

  const pages = useMemo(() => {
    const total = endPage - startPage + 1;
    return Array.from({ length: total }, (_, index) => startPage + index);
  }, [endPage, startPage]);

  useEffect(() => {
    let active = true;
    let loadedDocument = null;

    setPdf(null);
    setError('');

    pdfjs
      .getDocument({ url: pdfUrl })
      .promise.then((document) => {
        loadedDocument = document;

        if (!active) {
          document.destroy();
          return;
        }

        if (startPage < 1 || endPage > document.numPages || startPage > endPage) {
          setError('Não consegui localizar a página do hino nesse PDF.');
          return;
        }

        console.log('numeroNormalizado:', numeroNormalizado);
        console.log('pdfUrl:', pdfUrl);
        console.log('tituloEncontrado:', tituloEncontrado);
        console.log('paginaMapa:', paginaMapa);

        setPdf(document);
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        if (import.meta.env.DEV) {
          console.error('Erro ao carregar PDF:', pdfUrl, loadError);
        }

        setError('Não consegui abrir esse hinário.');
      });

    return () => {
      active = false;
      loadedDocument?.destroy();
    };
  }, [endPage, numeroNormalizado, paginaMapa, pdfUrl, startPage, tituloEncontrado]);

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

  if (!pdf) {
    return <div className="pdf-feedback">Carregando hino...</div>;
  }

  return (
    <div className="pdf-viewer" ref={containerRef}>
      <div className="pdf-status">
        <span>{pages.length === 1 ? '1 página carregada' : `${pages.length} páginas carregadas`}</span>
      </div>

      <div className="pdf-pages">
        {pages.map((pageNumber) => (
          <article key={pageNumber} className="pdf-page-card">
            <div className="pdf-page-label">Página {pageNumber}</div>
            <PdfPageCanvas pdf={pdf} pageNumber={pageNumber} containerWidth={containerWidth} />
          </article>
        ))}
      </div>
    </div>
  );
}
