import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(appRoot, 'tmp', 'pdfs');

const packageJson = JSON.parse(await fs.readFile(path.join(appRoot, 'package.json'), 'utf8'));
const canticosMap = JSON.parse(await fs.readFile(path.join(appRoot, 'src', 'data', 'canticosMap.json'), 'utf8'));
const vozDeMelodiaMap = JSON.parse(
  await fs.readFile(path.join(appRoot, 'src', 'data', 'vozDeMelodiaMap.json'), 'utf8'),
);

const hymnCounts = {
  canticos: Object.keys(canticosMap).length,
  vozDeMelodia: Object.keys(vozDeMelodiaMap).length,
};

const summary = {
  title: 'App Summary',
  appName: 'Hymn Viewer Web App',
  repoName: packageJson.name,
  whatItIs:
    'A mobile-first React/Vite web app for opening hymn pages from bundled PDF hymnals in a few taps. The active source code is centered on fast lookup and responsive reading during worship services.',
  whoItsFor:
    'Primary user/persona: people using a phone during church services who need quick access to hymn numbers and pages.',
  features: [
    'Switch between the bundled Voz de Melodia and Canticos hymnals.',
    'Accept numeric input only and normalize hymn numbers before lookup.',
    'Validate entries against pre-generated hymn maps instead of manual page searching.',
    'Show hymn title plus exact start/end pages after a successful match.',
    'Render one or multiple PDF pages responsively on canvas with pdf.js.',
    'Present a focused, mobile-first full-screen reading flow with a quick back action.',
  ],
  architecture: [
    'UI: App mounts HomePage, which owns hymnal selection, number input, lookup state, and error handling.',
    'Static data: src/data/hymnals.js wires two JSON hymn maps to /public/hinarios/*.pdf assets.',
    'Lookup flow: input -> normalizeHymnNumber -> getHymnByNumber -> selected hymn object -> HymnViewer.',
    'Rendering flow: HymnViewer passes the PDF file plus page range to PdfViewer; pdf.js loads the document and paints each page into canvas elements sized by ResizeObserver.',
    'Build support: scripts/generate-hymn-maps.mjs regenerates the JSON maps from the source PDF books in the workspace root.',
    'Runtime backend/API: Not found in repo for the active hymn-viewer flow.',
  ],
  runSteps: [
    'cd C:\\Users\\conta\\Canticos\\superintendencia-ebd',
    'npm install',
    'npm run dev',
    'Open the local Vite URL shown in the terminal.',
  ],
  evidenceNote: `Repo evidence note: the running source and package description describe a hymn viewer, while README, manifest, and service worker still contain older EBD admin text.`,
  countsLine: `Bundled content: Voz de Melodia (${hymnCounts.vozDeMelodia} mapped hymns) and Canticos (${hymnCounts.canticos} mapped hymns).`,
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function list(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(summary.title)}</title>
    <style>
      @page {
        size: A4;
        margin: 11mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        color: #18212f;
        background: #ffffff;
        font-size: 10.1pt;
        line-height: 1.26;
      }

      .page {
        width: 100%;
        min-height: calc(297mm - 22mm);
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 7.5mm;
      }

      .hero {
        border: 1px solid #d6dce5;
        border-radius: 14px;
        padding: 7mm 7.5mm 6mm;
        background: linear-gradient(135deg, #f4f7fb 0%, #fff8ef 100%);
      }

      .eyebrow {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 999px;
        background: #e4ebf5;
        color: #37506f;
        font-size: 8pt;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      h1 {
        margin: 4mm 0 1.4mm;
        font-size: 20pt;
        line-height: 1;
      }

      .subtitle {
        margin: 0;
        color: #46556a;
        font-size: 9.2pt;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: 1.06fr 0.94fr;
        gap: 6.5mm;
      }

      .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6.5mm;
        align-items: start;
      }

      .card {
        border: 1px solid #dfe5ed;
        border-radius: 12px;
        padding: 5mm 5.2mm 4.5mm;
        background: #ffffff;
      }

      h2 {
        margin: 0 0 2.2mm;
        color: #19334e;
        font-size: 9.1pt;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      p {
        margin: 0;
      }

      ul {
        margin: 0;
        padding-left: 4.4mm;
      }

      li + li {
        margin-top: 1.5mm;
      }

      .run-list li {
        margin-top: 1.1mm;
      }

      .mono {
        font-family: "Courier New", Courier, monospace;
        font-size: 9pt;
      }

      .footer-note {
        border-top: 1px solid #dfe5ed;
        padding-top: 3.2mm;
        color: #536172;
        font-size: 8.3pt;
      }

      .tight {
        display: grid;
        gap: 2.1mm;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <span class="eyebrow">Repo-Backed Brief</span>
        <h1>${escapeHtml(summary.appName)}</h1>
        <p class="subtitle">Repo package: ${escapeHtml(summary.repoName)}. ${escapeHtml(summary.countsLine)}</p>
      </section>

      <section class="summary-grid">
        <article class="card tight">
          <div>
            <h2>What It Is</h2>
            <p>${escapeHtml(summary.whatItIs)}</p>
          </div>
        </article>
        <article class="card tight">
          <div>
            <h2>Who It's For</h2>
            <p>${escapeHtml(summary.whoItsFor)}</p>
          </div>
        </article>
      </section>

      <section class="columns">
        <article class="card">
          <h2>What It Does</h2>
          <ul>${list(summary.features)}</ul>
        </article>

        <article class="card tight">
          <div>
            <h2>How It Works</h2>
            <ul>${list(summary.architecture)}</ul>
          </div>
          <div>
            <h2>How To Run</h2>
            <ul class="run-list">
              <li class="mono">${escapeHtml(summary.runSteps[0])}</li>
              <li class="mono">${escapeHtml(summary.runSteps[1])}</li>
              <li class="mono">${escapeHtml(summary.runSteps[2])}</li>
              <li>${escapeHtml(summary.runSteps[3])}</li>
            </ul>
          </div>
        </article>
      </section>

      <footer class="footer-note">
        ${escapeHtml(summary.evidenceNote)}
      </footer>
    </main>
  </body>
</html>
`;

await fs.mkdir(tmpDir, { recursive: true });
await fs.writeFile(path.join(tmpDir, 'app-summary.html'), html, 'utf8');

console.log(`HTML generated: ${path.join(tmpDir, 'app-summary.html')}`);
