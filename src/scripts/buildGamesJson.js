/**
 * Genera web/public/data/games.json a partir de todas las actas PDF en data/actas/
 *
 * Uso:
 *   node src/scripts/buildGamesJson.js
 */

const fs = require('fs');
const path = require('path');
const { convertPdfToJson } = require('./pdfConvert');

const ACTAS_DIR = path.join(process.cwd(), 'data', 'actas');
const OUT_DIR = path.join(process.cwd(), 'web', 'public', 'data');
const OUT_FILE = path.join(OUT_DIR, 'games.json');

async function main() {
  // Asegurar que existe el directorio de salida
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Buscar todos los PDFs
  const files = fs.readdirSync(ACTAS_DIR).filter(f => f.endsWith('.pdf'));

  if (files.length === 0) {
    console.log('⚠️  No se encontraron PDFs en', ACTAS_DIR);
    fs.writeFileSync(OUT_FILE, '[]', 'utf-8');
    return;
  }

  console.log(`📂 Procesando ${files.length} acta(s)...`);

  const games = [];
  for (const file of files) {
    const pdfPath = path.join(ACTAS_DIR, file);
    try {
      const game = await convertPdfToJson(pdfPath);
      games.push(game);
      console.log(`  ✅ ${file} → ${game.equipoA.nombre} ${game.equipoA.totalPuntos} - ${game.equipoB.totalPuntos} ${game.equipoB.nombre}`);
    } catch (err) {
      console.error(`  ❌ ${file}: ${err.message || err}`);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(games, null, 2), 'utf-8');
  console.log(`\n📊 ${games.length} partido(s) guardados en ${OUT_FILE}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
