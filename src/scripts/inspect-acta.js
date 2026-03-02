const fs = require('fs');
const path = require('path');

async function getPdfJs() {
  // Carga dinámica del build "legacy" recomendado para Node.js
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

async function dumpTextWithCoords(pdfPath) {
  const pdfjsLib = await getPdfJs();
  const absPath = path.resolve(pdfPath);
  const data = new Uint8Array(fs.readFileSync(absPath));
  const loadingTask = pdfjsLib.getDocument({ data, disableWorker: true });
  const pdf = await loadingTask.promise;

  console.log(`PDF cargado: ${absPath}, paginas: ${pdf.numPages}`);

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items = content.items.map((it) => {
      const [, , , , e, f] = it.transform;
      return {
        str: it.str,
        x: e,
        y: f,
      };
    });

    const outPath = path.join(process.cwd(), `debug_page_${pageNum}.json`);
    fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf8');
    console.log(`Guardado ${outPath} (${items.length} items)`);
  }
}

if (require.main === module) {
  (async () => {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
      console.error('Uso: node src/scripts/inspect-acta.js data/actas/xxx.pdf');
      process.exit(1);
    }

    try {
      await dumpTextWithCoords(pdfPath);
    } catch (err) {
      console.error('Error inspeccionando acta:', err.message || err);
      process.exit(1);
    }
  })();
}

module.exports = { dumpTextWithCoords };
