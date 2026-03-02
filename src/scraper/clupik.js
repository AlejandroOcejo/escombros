const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function ts() {
  return new Date().toISOString();
}

async function logDebug(debugDir, message) {
  const line = `[${ts()}] ${message}`;
  console.log(line);
  try {
    await fs.promises.appendFile(path.join(debugDir, 'scrape.log'), line + '\n');
  } catch (_) {}
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Busca específicamente los botones/enlaces de "Imprimir acta de partido"
async function findActaButtons(page, debugDir) {
  const selector = [
    'a.btn.btn-default:has-text("Imprimir acta de partido")',
    'a.btn:has-text("Imprimir acta de partido")',
    'a:has-text("Imprimir acta de partido")',
    'a:has-text("Imprimir acta")',
    'a[href$=".pdf"]'
  ].join(', ');

  try {
    await page.waitForSelector(selector, { timeout: 10000 });
  } catch (_) {}

  const loc = page.locator(selector);
  const count = await loc.count();
  await logDebug(debugDir, `Botones/enlaces de acta encontrados: ${count}`);
  return loc;
}

async function fetchWithContext(context, url) {
  const res = await context.request.get(url);
  if (!res.ok()) {
    throw new Error(`Fallo al descargar ${url}: ${res.status()} ${res.statusText()}`);
  }
  const ct = res.headers()['content-type'] || '';
  const buf = await res.body();
  return { contentType: ct, body: buf };
}

// Ignoramos login/email/password: solo usamos resultsUrl
async function scrapeActas({
  resultsUrl,
  downloadDir = path.join(process.cwd(), 'data', 'actas')
}) {
  await ensureDir(downloadDir);
  const debugDir = path.join(process.cwd(), 'data', 'debug');
  await ensureDir(debugDir);

  const headless = process.env.HEADLESS !== 'false';

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await logDebug(debugDir, 'Inicio scraping SIMPLE (sin login)');
    await logDebug(debugDir, `Results URL: ${resultsUrl}`);
    await logDebug(debugDir, `Headless: ${headless}`);

    // Si no viene por parámetro, usa directamente la URL fija que me has pasado
    if (!resultsUrl) {
      resultsUrl = 'https://clupik.pro/es/admin/club/9582475/last-results?third-party-session-id=IUpfqkWb1URLcJkUFeQFxzfUrnHSV50imeH7ONMw';
    }

    await page.goto(resultsUrl, { waitUntil: 'networkidle' });
    await logDebug(debugDir, `Navegado a resultados: ${page.url()}`);

    try {
      await page.screenshot({
        path: path.join(debugDir, 'results.png'),
        fullPage: true
      });
    } catch (_) {}

    // Scrolleo básico por si carga lazy
    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
    } catch (_) {}

    const anchors = await findActaButtons(page, debugDir);
    const count = await anchors.count();

    if (!count) {
      const html = await page.content();
      await fs.promises.writeFile(path.join(debugDir, 'results.html'), html, 'utf8');
      await logDebug(debugDir, 'No se encontraron botones de acta; guardado results.html y results.png');
      return { savedFiles: [], links: [], message: 'No se encontraron botones de acta.' };
    }

    const links = [];
    for (let i = 0; i < count; i++) {
      const href = await anchors.nth(i).getAttribute('href');
      if (!href) continue;
      const url = new URL(href, page.url()).toString();
      links.push(url);
    }

    await logDebug(debugDir, `Links de acta recopilados: ${links.length}`);

    const savedFiles = [];
    for (let i = 0; i < links.length; i++) {
      const url = links[i];
      await logDebug(debugDir, `Descargando ${url}`);
      try {
        const { contentType, body } = await fetchWithContext(context, url);
        const isPdf = contentType.toLowerCase().includes('pdf');

        let baseName = path.basename(new URL(url).pathname);
        if (!baseName || baseName === '/' || baseName === '.') {
          baseName = `acta-${i + 1}`;
        }
        // Asegura extensión .pdf cuando realmente es un PDF
        if (isPdf && !baseName.toLowerCase().endsWith('.pdf')) {
          baseName += '.pdf';
        }

        const outPath = path.join(downloadDir, sanitizeFilename(baseName));
        await fs.promises.writeFile(outPath, body);

        if (isPdf) {
          savedFiles.push(outPath);
          await logDebug(debugDir, `Guardado PDF ${outPath}`);
        } else {
          await logDebug(debugDir, `Guardado (no PDF, NO se convertirá) ${outPath} [${contentType}]`);
        }
      } catch (e) {
        await logDebug(debugDir, `Descarga directa fallida para ${url}: ${e.message}`);
      }
    }

    return { savedFiles, links };
  } finally {
    try {
      await logDebug(debugDir, 'Cerrando navegador y contexto');
    } catch (_) {}
    await context.close();
    await browser.close();
  }
}

module.exports = { scrapeActas };
