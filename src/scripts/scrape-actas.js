const path = require('path');
const dotenv = require('dotenv');
const { scrapeActas } = require('../scraper/clupik');
const { convertPdfToExcel } = require('./pdfConvert');

dotenv.config();

async function main() {
  // URL fija de Clupik que nos has indicado
  const resultsUrl = 'https://clupik.pro/es/admin/club/9582475/last-results?third-party-session-id=IUpfqkWb1URLcJkUFeQFxzfUrnHSV50imeH7ONMw';
  const downloadDir = process.env.DOWNLOAD_DIR || path.join(process.cwd(), 'data', 'actas');
  const headless = process.env.HEADLESS !== 'false';

  console.log('Iniciando scraping de actas (sin login, URL fija de Clupik)...');
  console.log(`Headless: ${headless}`);

  const { savedFiles, links, message } = await scrapeActas({ resultsUrl, downloadDir });
  if (message) console.log(message);
  console.log(`Enlaces encontrados: ${links.length}`);
  links.forEach((l) => console.log(` - ${l}`));
  console.log(`Archivos guardados: ${savedFiles.length}`);
  savedFiles.forEach((f) => console.log(` + ${f}`));

  // Después de descargar los PDFs, convertimos cada acta a Excel
  for (const pdfPath of savedFiles) {
    try {
      await convertPdfToExcel(pdfPath);
    } catch (err) {
      console.error(`Error convirtiendo ${pdfPath} a Excel:`, err.message || err);
    }
  }
}

main().catch((err) => {
  console.error('Error durante scraping:', err);
  process.exit(1);
});
