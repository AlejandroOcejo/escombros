/**
 * Acta FEB -> Excel
 * Uso:
 *   node pdfConvert.js acta.pdf
 *
 * Utiliza pdfjs-dist con coordenadas para extraer datos de forma robusta.
 */

const XLSX = require('xlsx');

// Importar el parser basado en coordenadas
const { parseActaPDF } = require('./pdfParserCoords.js');

// =====================
// EXCEL
// =====================
function crearExcel(equipoA, equipoB, nombreArchivo) {
  const wb = XLSX.utils.book_new();

  const wsA = XLSX.utils.json_to_sheet(equipoA);
  const wsB = XLSX.utils.json_to_sheet(equipoB);

  XLSX.utils.book_append_sheet(wb, wsA, 'Equipo A');
  XLSX.utils.book_append_sheet(wb, wsB, 'Equipo B');

  XLSX.writeFile(wb, nombreArchivo);
}

// =====================
// FUNCIÓN REUTILIZABLE (usando parser basado en coordenadas)
// =====================
async function convertPdfToExcel(pdfPath) {
  console.log('📄 Procesando PDF con parser de coordenadas...');

  // Usar el nuevo parser basado en coordenadas (pdfjs-dist)
  const resultado = await parseActaPDF(pdfPath);

  if (!resultado.equipoA.jugadores.length && !resultado.equipoB.jugadores.length) {
    throw new Error('No se han detectado jugadores en el acta');
  }

  // Preparar datos para Excel - función común
  const mapJugador = j => ({
    Dorsal: j.dorsal,
    Nombre: j.nombre,
    Puntos: j.puntos,
    Triples: j.triples,
    'TL Anotados': j.tlAnotados,
    'TL Intentados': j.tlIntentados,
    'TL %': j.tlPct,
    Faltas: j.faltas,
    Eliminado: j.eliminado ? 'Sí' : ''
  });

  const equipoA = resultado.equipoA.jugadores.map(mapJugador);
  const equipoB = resultado.equipoB.jugadores.map(mapJugador);

  // Fila vacía de resumen
  const emptyRow = { Dorsal: '', Nombre: '', Puntos: '', Triples: '', 'TL Anotados': '', 'TL Intentados': '', 'TL %': '', Faltas: '', Eliminado: '' };
  const resumenRow = (label, puntos) => ({ ...emptyRow, Nombre: label, Puntos: puntos });

  equipoA.push(emptyRow);
  equipoA.push(resumenRow('PUNTOS CALCULADOS', resultado.equipoA.puntosCalculados));
  equipoA.push(resumenRow('RESULTADO FINAL', resultado.equipoA.totalPuntos));

  equipoB.push(emptyRow);
  equipoB.push(resumenRow('PUNTOS CALCULADOS', resultado.equipoB.puntosCalculados));
  equipoB.push(resumenRow('RESULTADO FINAL', resultado.equipoB.totalPuntos));

  const out = pdfPath.replace(/\.pdf$/i, '') + '_estadisticas.xlsx';
  console.log(`📊 Generando Excel: ${out}`);
  crearExcel(equipoA, equipoB, out);

  console.log('✅ Hecho');

  return out;
}

// =====================
// JSON (para la web)
// =====================
async function convertPdfToJson(pdfPath) {
  const resultado = await parseActaPDF(pdfPath);

  if (!resultado.equipoA.jugadores.length && !resultado.equipoB.jugadores.length) {
    throw new Error('No se han detectado jugadores en el acta');
  }

  // Obtener hash del fichero para identificar el partido
  const crypto = require('crypto');
  const pdfBuf = require('fs').readFileSync(pdfPath);
  const hash = crypto.createHash('sha1').update(pdfBuf).digest('hex');

  return {
    id: hash,
    archivo: require('path').basename(pdfPath),
    equipoA: resultado.equipoA,
    equipoB: resultado.equipoB,
    resultadoFinal: resultado.resultadoFinal
  };
}

module.exports = { convertPdfToExcel, convertPdfToJson };

// =====================
// MODO CLI DIRECTO
// =====================
if (require.main === module) {
  (async () => {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
      console.error('❌ Uso: node pdfConvert.js acta.pdf');
      process.exit(1);
    }

    try {
      await convertPdfToExcel(pdfPath);
    } catch (err) {
      console.error('❌ Error convirtiendo PDF:', err.message || err);
      process.exit(1);
    }
  })();
}
