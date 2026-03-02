/**
 * Parser robusto de actas FEB usando pdfjs-dist con coordenadas.
 * Reconstruye tablas agrupando elementos por posición Y y ordenando por X.
 */

const fs = require('fs');
const path = require('path');

// Tolerancia en puntos para agrupar elementos en la misma fila
const Y_TOLERANCE = 4;
// Separación mínima en X para considerar espacios entre celdas
const X_GAP_THRESHOLD = 8;

/**
 * Carga pdfjs-dist (build legacy para Node)
 */
async function getPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

/**
 * Extrae todos los items de texto con coordenadas de un PDF
 */
async function extractItemsWithCoords(pdfPath) {
  const pdfjsLib = await getPdfJs();
  const absPath = path.resolve(pdfPath);
  const data = new Uint8Array(fs.readFileSync(absPath));
  const loadingTask = pdfjsLib.getDocument({ data, disableWorker: true });
  const pdf = await loadingTask.promise;

  const allItems = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!item.str || item.str.trim() === '') continue;

      const [, , , , x, y] = item.transform;
      allItems.push({
        str: item.str,
        x: x,
        // Invertir Y para que sea de arriba a abajo
        y: viewport.height - y,
        page: pageNum,
        width: item.width || 0
      });
    }
  }

  return allItems;
}

/**
 * Agrupa items por filas (similar coordenada Y)
 */
function groupIntoRows(items, tolerance = Y_TOLERANCE) {
  if (!items.length) return [];

  // Ordenar por Y (de arriba a abajo) y luego por X
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const rows = [];
  let currentRow = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= tolerance) {
      currentRow.push(item);
    } else {
      // Nueva fila
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
    }
  }

  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.x - b.x);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Convierte una fila de items en texto, preservando separación
 */
function rowToText(row) {
  if (!row.length) return '';

  let result = row[0].str;
  for (let i = 1; i < row.length; i++) {
    const gap = row[i].x - (row[i - 1].x + (row[i - 1].width || 0));
    if (gap > X_GAP_THRESHOLD) {
      result += '\t';
    } else if (gap > 2) {
      result += ' ';
    }
    result += row[i].str;
  }
  return result;
}

/**
 * Encuentra items dentro de una región específica
 */
function filterByRegion(items, minX, maxX, minY, maxY) {
  return items.filter(item =>
    item.x >= minX && item.x <= maxX &&
    item.y >= minY && item.y <= maxY
  );
}

/**
 * Busca un item que contenga el texto especificado
 */
function findItem(items, text, caseSensitive = false) {
  const searchText = caseSensitive ? text : text.toLowerCase();
  return items.find(item => {
    const itemText = caseSensitive ? item.str : item.str.toLowerCase();
    return itemText.includes(searchText);
  });
}

/**
 * Busca todos los items que contengan el texto especificado
 */
function findAllItems(items, text, caseSensitive = false) {
  const searchText = caseSensitive ? text : text.toLowerCase();
  return items.filter(item => {
    const itemText = caseSensitive ? item.str : item.str.toLowerCase();
    return itemText.includes(searchText);
  });
}

/**
 * Extrae información de equipos
 */
function extractEquipos(items) {
  const equipoAItem = findItem(items, 'Equipo A');
  const equipoBItem = findItem(items, 'Equipo B');

  if (!equipoAItem || !equipoBItem) {
    return { equipoA: 'Equipo A', equipoB: 'Equipo B' };
  }

  // Buscar nombres de equipos cerca de las etiquetas
  const equipoAName = items.find(item =>
    item.y >= equipoAItem.y - 5 &&
    item.y <= equipoAItem.y + 5 &&
    item.x > equipoAItem.x + 40 &&
    item.x < equipoBItem.x - 40 &&
    item.str.length > 3 &&
    !item.str.includes('Equipo')
  );

  const equipoBName = items.find(item =>
    item.y >= equipoBItem.y - 5 &&
    item.y <= equipoBItem.y + 5 &&
    item.x > equipoBItem.x + 40 &&
    item.str.length > 3 &&
    !item.str.includes('Equipo')
  );

  return {
    equipoA: equipoAName?.str?.trim() || 'Equipo A',
    equipoB: equipoBName?.str?.trim() || 'Equipo B'
  };
}

/**
 * Extrae jugadores de una sección de equipo
 */
function extractJugadores(items, startY, endY, maxX = 250) {
  const jugadores = [];

  // Filtrar items en la región de jugadores (lado izquierdo)
  const regionItems = filterByRegion(items, 0, maxX, startY, endY);

  if (process.env.DEBUG_PDF === 'true') {
    console.log(`  [DEBUG] extractJugadores región Y:[${startY.toFixed(1)}-${endY.toFixed(1)}] -> ${regionItems.length} items`);
  }

  const rows = groupIntoRows(regionItems, 4);

  for (const row of rows) {
    // Buscar patrón: NOMBRE + DORSAL + X + [faltas]
    const dorsal = row.find(item => /^\d{1,2}$/.test(item.str.trim()));
    const hasX = row.some(item => item.str.trim() === 'X');

    if (!dorsal || !hasX) continue;

    const dorsalNum = parseInt(dorsal.str.trim(), 10);

    // Extraer nombre (items antes del dorsal)
    const nameItems = row.filter(item =>
      item.x < dorsal.x - 5 &&
      !/^\(\d+\)$/.test(item.str.trim()) &&
      !/^\(N\/A\)$/.test(item.str.trim()) &&
      !/^Lic\.?$/.test(item.str.trim()) &&
      item.str.trim().length > 0
    );

    let nombre = nameItems.map(i => i.str.trim()).join(' ').trim();
    // Limpiar sufijos como "(CA" que vienen cortados
    nombre = nombre.replace(/\s*\(CA[P]?$/, '').trim();

    if (nombre.length < 3) continue;
    if (/entrenador|ayudante|delegado/i.test(nombre)) continue;

    // Contar faltas (números después de X)
    const xItem = row.find(item => item.str.trim() === 'X');
    const faltaItems = row.filter(item =>
      item.x > xItem.x &&
      /^\d$/.test(item.str.trim())
    );
    const numFaltas = faltaItems.length;

    jugadores.push({
      dorsal: dorsalNum,
      nombre: nombre,
      puntos: 0,
      triples: 0,
      tlAnotados: 0,
      tlIntentados: 0,
      tlPct: '',
      faltas: numFaltas,
      eliminado: numFaltas >= 5
    });
  }

  return jugadores;
}

/**
 * Extrae el resultado final del partido
 */
function extractResultadoFinal(items) {
  const finalItem = findItem(items, 'Final');
  if (!finalItem) return null;

  // Buscar "A" y "B" con sus marcadores
  const resultItems = items.filter(item =>
    item.y > finalItem.y &&
    item.y < finalItem.y + 50
  );

  // Buscar etiquetas A y B
  const labelA = resultItems.find(item => item.str.trim() === 'A' && item.x < 280);
  const labelB = resultItems.find(item => item.str.trim() === 'B' && item.x < 280);

  if (!labelA || !labelB) return null;

  // Buscar dígitos en la misma fila que A (tolerancia Y)
  const digitsA = resultItems.filter(item =>
    Math.abs(item.y - labelA.y) < 5 &&
    /^\d$/.test(item.str.trim()) &&
    item.x > labelA.x
  ).sort((a, b) => a.x - b.x);

  const digitsB = resultItems.filter(item =>
    Math.abs(item.y - labelB.y) < 5 &&
    /^\d$/.test(item.str.trim()) &&
    item.x > labelB.x
  ).sort((a, b) => a.x - b.x);

  // Combinar dígitos para formar el número
  const puntosA = digitsA.length > 0 ? parseInt(digitsA.map(d => d.str).join(''), 10) : 0;
  const puntosB = digitsB.length > 0 ? parseInt(digitsB.map(d => d.str).join(''), 10) : 0;

  return { puntosA, puntosB };
}

/**
 * Localiza las posiciones X de las cabeceras A / M / B de cada periodo
 * en la zona del tanteo. Devuelve un array de objetos { A, M, B } por periodo.
 */
function detectarCabecerasPeriodos(items) {
  // Buscar los headers A/M/B que están justo debajo de "PRIMER TIEMPO"
  const primerTiempo = findItem(items, 'PRIMER TIEMPO');
  if (!primerTiempo) return [];

  // Los headers A/M/B están ~23-25 unidades por debajo (Y mayor) en coordenadas invertidas
  const headerY = primerTiempo.y + 23;
  const headerItems = items.filter(item =>
    Math.abs(item.y - headerY) < 8 &&
    item.x > 250 &&
    /^[AMB]$/.test(item.str.trim())
  ).sort((a, b) => a.x - b.x);

  // Agrupar en ternas A/M/B consecutivas
  const periodos = [];
  let i = 0;
  while (i + 2 < headerItems.length) {
    const a = headerItems[i];
    const m = headerItems[i + 1];
    const b = headerItems[i + 2];
    if (a.str.trim() === 'A' && m.str.trim() === 'M' && b.str.trim() === 'B') {
      periodos.push({ A: a.x, M: m.x, B: b.x });
      i += 3;
    } else {
      i++;
    }
  }

  return periodos;
}

/**
 * Construye los rangos X de las 5 columnas de cada periodo a partir de las cabeceras.
 *
 * Formato FEB conteo: 5 columnas por cuarto:
 *   Col1 = Dorsal equipo A
 *   Col2 = Puntos acumulados equipo A
 *   Col3 = Minuto del cuarto (cabecera M)
 *   Col4 = Dorsal equipo B
 *   Col5 = Puntos acumulados equipo B
 *
 * Las cabeceras PDF son A (cubre Col1+Col2), M (Col3), B (cubre Col4+Col5).
 */
function construirColumnasPeriodos(periodos) {
  return periodos.map((p, idx) => {
    // Calculamos límites usando los puntos medios entre cabeceras
    const midAM = (p.A + p.M) / 2;   // frontera Col2 / Col3
    const midMB = (p.M + p.B) / 2;   // frontera Col3 / Col4

    // Margen izquierdo: 12 pts antes de A
    const left = p.A - 12;
    // Margen derecho: 15 pts después de B (o inicio del siguiente periodo)
    const right = idx + 1 < periodos.length ? periodos[idx + 1].A - 12 : p.B + 18;

    return {
      periodo: idx + 1,
      // Rangos [min, max] en X para cada columna
      col1: [left, p.A],         // Dorsal A
      col2: [p.A, midAM],        // Puntos acum. A
      col3: [midAM, midMB],      // Minuto
      col4: [midMB, p.B],        // Dorsal B
      col5: [p.B, right]         // Puntos acum. B
    };
  });
}

/**
 * Clasifica un item en su columna dentro de un periodo.
 * Devuelve null si no cae dentro de ninguna columna.
 */
function clasificarEnColumna(item, cols) {
  const x = item.x;
  if (x >= cols.col1[0] && x < cols.col1[1]) return 'dorsalA';
  if (x >= cols.col2[0] && x < cols.col2[1]) return 'scoreA';
  if (x >= cols.col3[0] && x < cols.col3[1]) return 'minuto';
  if (x >= cols.col4[0] && x < cols.col4[1]) return 'dorsalB';
  if (x >= cols.col5[0] && x <= cols.col5[1]) return 'scoreB';
  return null;
}

/**
 * Extrae el tanteo (play-by-play) de la sección de conteo del acta FEB.
 *
 * Cada cuarto tiene 5 columnas:
 *   DorsalA | PuntosAcumA | Minuto | DorsalB | PuntosAcumB
 *
 * Los puntos son acumulados a lo largo de todo el partido (no se reinician
 * por periodo). Ejemplo: si P1 termina con A=13 B=14, el primer valor de
 * P2 partirá de esos totales.
 *
 * Los periodos se procesan uno a uno (P1 → P2 → P3 → P4 → extras) para
 * respetar el orden cronológico, ya que cada periodo ocupa una columna
 * distinta pero la numeración es continua.
 */
function extractTanteo(items) {
  const jugadas = [];

  // 1. Detectar cabeceras
  const periodoHeaders = detectarCabecerasPeriodos(items);
  if (!periodoHeaders.length) {
    console.warn('⚠️  No se encontraron cabeceras A/M/B del tanteo');
    return jugadas;
  }

  const columnas = construirColumnasPeriodos(periodoHeaders);

  if (process.env.DEBUG_PDF === 'true') {
    console.log('  [DEBUG] Periodos detectados:', periodoHeaders.length);
    columnas.forEach(c => {
      console.log(`  [DEBUG] P${c.periodo}: col1=[${c.col1.map(v => v.toFixed(1))}] col2=[${c.col2.map(v => v.toFixed(1))}] col3=[${c.col3.map(v => v.toFixed(1))}] col4=[${c.col4.map(v => v.toFixed(1))}] col5=[${c.col5.map(v => v.toFixed(1))}]`);
    });
  }

  // 2. Determinar rango Y del tanteo
  const primerTiempo = findItem(items, 'PRIMER TIEMPO');
  const finalItem = findItem(items, 'Final');

  // Localizar la Y real de los headers A/M/B para poner el límite justo después
  const headerY = primerTiempo.y + 23;
  const headerItems = items.filter(item =>
    Math.abs(item.y - headerY) < 8 &&
    item.x > 250 &&
    /^[AMB]$/.test(item.str.trim())
  );
  const realHeaderY = headerItems.length
    ? Math.max(...headerItems.map(h => h.y))
    : primerTiempo.y + 30;

  const tanteoMinY = realHeaderY + 3; // justo después de las cabeceras A/M/B
  const tanteoMaxY = finalItem ? finalItem.y - 5 : tanteoMinY + 600;

  // Detectar Y de las filas-resumen de periodo (contienen etiquetas "A" o "B" aisladas)
  // Estas filas muestran los totales por periodo y NO son jugadas
  const resumenYs = new Set();
  const etiquetasResumen = items.filter(item =>
    item.y >= tanteoMinY && item.y <= tanteoMaxY &&
    item.x > 250 &&
    /^[AB]$/.test(item.str.trim())
  );
  for (const et of etiquetasResumen) {
    resumenYs.add(Math.round(et.y * 10) / 10);
  }

  // Rango X global (desde primera col1 hasta última col5)
  const globalMinX = columnas[0].col1[0];
  const globalMaxX = columnas[columnas.length - 1].col5[1];

  // 3. Filtrar items numéricos Y guiones en la zona del tanteo, excluyendo filas-resumen
  const tanteoItems = items.filter(item => {
    if (item.y < tanteoMinY || item.y > tanteoMaxY) return false;
    if (item.x < globalMinX || item.x > globalMaxX) return false;
    const s = item.str.trim();
    if (!/^\d+$/.test(s) && s !== '-') return false;
    // Excluir items en filas de resumen (tolerancia ±3)
    for (const ry of resumenYs) {
      if (Math.abs(item.y - ry) < 3) return false;
    }
    return true;
  });

  // 4. Agrupar en filas por coordenada Y
  const rows = groupIntoRows(tanteoItems, 5);
  // Ordenar filas cronológicamente (Y creciente = de arriba a abajo)
  rows.sort((a, b) => a[0].y - b[0].y);

  // 5. Marcadores acumulados globales (comunes a todos los periodos)
  let prevScoreA = 0;
  let prevScoreB = 0;

  // Último dorsal anotador por equipo (para canastas sin dorsal visible)
  let lastScorerA = null;
  let lastScorerB = null;
  // Último dorsal que intentó un tiro libre (hecho o fallado)
  // Los TL van en tandas (1, 2 o 3 intentos seguidos del mismo jugador),
  // así que cuando un '-' o un TL anotado no tiene dorsal, pertenece
  // al último que lanzó un TL, no al último que anotó canasta.
  let lastFtShooterA = null;
  let lastFtShooterB = null;

  // 6. Procesar periodos en orden cronológico (P1 entero, luego P2, etc.)
  for (let p = 0; p < columnas.length; p++) {
    const cols = columnas[p];

    // Extraer datos de este periodo para cada fila
    const entradasPeriodo = [];

    for (const row of rows) {
      const datos = { dorsalA: null, scoreA: null, minuto: null, dorsalB: null, scoreB: null, missA: false, missB: false, y: row[0].y };

      for (const item of row) {
        const col = clasificarEnColumna(item, cols);
        if (col) {
          const s = item.str.trim();
          if (s === '-') {
            // Tiro libre fallado: '-' en columna de score
            if (col === 'scoreA') datos.missA = true;
            if (col === 'scoreB') datos.missB = true;
          } else {
            const val = parseInt(s, 10);
            if (!isNaN(val)) {
              datos[col] = val;
            }
          }
        }
      }

      // Solo incluir si hay al menos un dato de scoring o fallo en este periodo
      if (datos.scoreA !== null || datos.scoreB !== null || datos.dorsalA !== null || datos.dorsalB !== null || datos.missA || datos.missB) {
        entradasPeriodo.push(datos);
      }
    }

    // Las entradas ya están ordenadas por Y (cronológicamente)
    for (const datos of entradasPeriodo) {
      // --- Equipo A ---
      if (datos.scoreA !== null && datos.scoreA > prevScoreA) {
        const puntos = datos.scoreA - prevScoreA;
        let dorsal = datos.dorsalA;
        const esTl = puntos === 1;

        // Fallback: si no hay dorsal y es TL, usar lastFtShooter; si no, lastScorer
        if (dorsal === null && esTl) {
          dorsal = lastFtShooterA !== null ? lastFtShooterA : lastScorerA;
        }

        if (puntos > 0 && puntos <= 4) {
          jugadas.push({
            dorsal,
            puntos,
            marcadorAcumA: datos.scoreA,
            minuto: datos.minuto,
            equipo: 'A',
            periodo: p + 1,
            tipo: puntos === 3 ? 'triple' : esTl ? 'tl' : 'canasta'
          });
          if (dorsal !== null) {
            if (esTl) {
              lastFtShooterA = dorsal;
            } else {
              lastScorerA = dorsal;
              lastFtShooterA = null; // tanda de TL terminada
            }
          }
        }
        prevScoreA = datos.scoreA;
      }
      // Tiro libre fallado equipo A
      if (datos.missA) {
        let dorsal = datos.dorsalA;
        if (dorsal === null) {
          dorsal = lastFtShooterA !== null ? lastFtShooterA : lastScorerA;
        }
        jugadas.push({
          dorsal,
          puntos: 0,
          equipo: 'A',
          periodo: p + 1,
          tipo: 'tl_fallado'
        });
        if (dorsal !== null) lastFtShooterA = dorsal;
      }

      // --- Equipo B ---
      if (datos.scoreB !== null && datos.scoreB > prevScoreB) {
        const puntos = datos.scoreB - prevScoreB;
        let dorsal = datos.dorsalB;
        const esTl = puntos === 1;

        if (dorsal === null && esTl) {
          dorsal = lastFtShooterB !== null ? lastFtShooterB : lastScorerB;
        }

        if (puntos > 0 && puntos <= 4) {
          jugadas.push({
            dorsal,
            puntos,
            marcadorAcumB: datos.scoreB,
            minuto: datos.minuto,
            equipo: 'B',
            periodo: p + 1,
            tipo: puntos === 3 ? 'triple' : esTl ? 'tl' : 'canasta'
          });
          if (dorsal !== null) {
            if (esTl) {
              lastFtShooterB = dorsal;
            } else {
              lastScorerB = dorsal;
              lastFtShooterB = null;
            }
          }
        }
        prevScoreB = datos.scoreB;
      }
      // Tiro libre fallado equipo B
      if (datos.missB) {
        let dorsal = datos.dorsalB;
        if (dorsal === null) {
          dorsal = lastFtShooterB !== null ? lastFtShooterB : lastScorerB;
        }
        jugadas.push({
          dorsal,
          puntos: 0,
          equipo: 'B',
          periodo: p + 1,
          tipo: 'tl_fallado'
        });
        if (dorsal !== null) lastFtShooterB = dorsal;
      }
    }

    if (process.env.DEBUG_PDF === 'true') {
      console.log(`  [DEBUG] P${p + 1}: ${entradasPeriodo.length} filas, marcador acum -> A=${prevScoreA} B=${prevScoreB}`);
    }
  }

  return jugadas;
}

/**
 * Asigna puntos a los jugadores basándose en las jugadas extraídas del tanteo.
 */
function asignarPuntos(equipoA, equipoB, jugadas) {
  const mapaA = new Map();
  const mapaB = new Map();

  for (const j of equipoA) mapaA.set(j.dorsal, j);
  for (const j of equipoB) mapaB.set(j.dorsal, j);

  for (const jugada of jugadas) {
    if (jugada.dorsal === null) continue; // fila sin dorsal visible
    const mapa = jugada.equipo === 'A' ? mapaA : mapaB;
    const jugador = mapa.get(jugada.dorsal);
    if (!jugador) {
      if (process.env.DEBUG_PDF === 'true') {
        console.warn(`  [DEBUG] Dorsal ${jugada.dorsal} no encontrado en Equipo ${jugada.equipo}`);
      }
      continue;
    }

    jugador.puntos += jugada.puntos;

    if (jugada.tipo === 'triple') {
      jugador.triples++;
    } else if (jugada.tipo === 'tl') {
      jugador.tlAnotados++;
      jugador.tlIntentados++;
    } else if (jugada.tipo === 'tl_fallado') {
      jugador.tlIntentados++;
    }
  }

  // Calcular porcentajes
  const calcPct = (jugadores) => {
    for (const j of jugadores) {
      if (j.tlIntentados > 0) {
        j.tlPct = Math.round((j.tlAnotados / j.tlIntentados) * 100) + '%';
      }
    }
  };
  calcPct(equipoA);
  calcPct(equipoB);

  return { equipoA, equipoB };
}

/**
 * Función principal - parsea un PDF de acta FEB
 */
async function parseActaPDF(pdfPath) {
  console.log('📄 Extrayendo datos del PDF con coordenadas...');

  const items = await extractItemsWithCoords(pdfPath);

  if (!items.length) {
    throw new Error('No se pudieron extraer items del PDF');
  }

  // DEBUG: Guardar items para análisis
  if (process.env.DEBUG_PDF === 'true') {
    fs.writeFileSync('debug_items.json', JSON.stringify(items, null, 2));
    console.log('📝 Items guardados en debug_items.json');
  }

  // Detectar estructura del documento
  const equipos = extractEquipos(items);
  console.log(`📋 Equipos: ${equipos.equipoA} vs ${equipos.equipoB}`);

  // Buscar marcadores de secciones
  const jugadoresHeaders = findAllItems(items, 'Jugadores').sort((a, b) => a.y - b.y);
  // Buscar "Entrenador" solo en la columna izquierda (x < 100)
  const entrenadorItems = items
    .filter(item => item.str === 'Entrenador' && item.x < 100)
    .sort((a, b) => a.y - b.y);

  if (process.env.DEBUG_PDF === 'true') {
    console.log(`  [DEBUG] Jugadores headers: ${jugadoresHeaders.map(h => `y=${h.y.toFixed(1)}`).join(', ')}`);
    console.log(`  [DEBUG] Entrenadores: ${entrenadorItems.map(e => `y=${e.y.toFixed(1)}`).join(', ')}`);
  }

  // Encontrar las dos secciones de jugadores (una por equipo)
  let equipoAJugadores = [];
  let equipoBJugadores = [];

  if (jugadoresHeaders.length >= 2 && entrenadorItems.length >= 2) {
    const header1 = jugadoresHeaders[0];
    const header2 = jugadoresHeaders[1];
    const entrenador1 = entrenadorItems[0];
    const entrenador2 = entrenadorItems[1];

    // Jugadores equipo A: desde header1 hasta entrenador1
    equipoAJugadores = extractJugadores(items, header1.y + 5, entrenador1.y - 5, 250);
    console.log(`👥 Equipo A: ${equipoAJugadores.length} jugadores encontrados`);

    // Jugadores equipo B: desde header2 hasta entrenador2
    equipoBJugadores = extractJugadores(items, header2.y + 5, entrenador2.y - 5, 250);
    console.log(`👥 Equipo B: ${equipoBJugadores.length} jugadores encontrados`);
  } else if (jugadoresHeaders.length >= 1 && entrenadorItems.length >= 1) {
    // Fallback: intentar extraer al menos un equipo
    const header1 = jugadoresHeaders[0];
    const entrenador1 = entrenadorItems[0];
    equipoAJugadores = extractJugadores(items, header1.y + 5, entrenador1.y - 5, 250);
    console.log(`👥 Equipo A: ${equipoAJugadores.length} jugadores encontrados`);
    console.warn('⚠️  Solo se pudo extraer un equipo');
  }

  // Extraer resultado final del partido
  const resultadoFinal = extractResultadoFinal(items);
  if (resultadoFinal) {
    console.log(`🏆 Resultado final: ${equipos.equipoA} ${resultadoFinal.puntosA} - ${resultadoFinal.puntosB} ${equipos.equipoB}`);
  }

  // Extraer tanteo para puntos individuales
  console.log('🏀 Extrayendo tanteo...');
  const jugadas = extractTanteo(items);
  console.log(`📊 ${jugadas.length} jugadas extraídas`);

  // Asignar puntos
  asignarPuntos(equipoAJugadores, equipoBJugadores, jugadas);

  // Calcular totales desde jugadas
  const totalCalculadoA = equipoAJugadores.reduce((sum, j) => sum + j.puntos, 0);
  const totalCalculadoB = equipoBJugadores.reduce((sum, j) => sum + j.puntos, 0);

  // Usar resultado real si está disponible, sino el calculado
  const totalA = resultadoFinal ? resultadoFinal.puntosA : totalCalculadoA;
  const totalB = resultadoFinal ? resultadoFinal.puntosB : totalCalculadoB;

  // Advertir si hay discrepancia significativa
  if (resultadoFinal && (totalCalculadoA !== totalA || totalCalculadoB !== totalB)) {
    console.warn(`⚠️  Puntos individuales parciales (${totalCalculadoA}-${totalCalculadoB}) - el tanteo play-by-play es difícil de parsear`);
  }

  return {
    equipoA: {
      nombre: equipos.equipoA,
      jugadores: equipoAJugadores,
      totalPuntos: totalA,
      puntosCalculados: totalCalculadoA
    },
    equipoB: {
      nombre: equipos.equipoB,
      jugadores: equipoBJugadores,
      totalPuntos: totalB,
      puntosCalculados: totalCalculadoB
    },
    resultadoFinal
  };
}

module.exports = {
  parseActaPDF,
  extractItemsWithCoords,
  extractResultadoFinal,
  groupIntoRows,
  rowToText,
  filterByRegion,
  findItem,
  findAllItems
};

// CLI
if (require.main === module) {
  (async () => {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
      console.error('Uso: node pdfParserCoords.js acta.pdf');
      process.exit(1);
    }

    try {
      const result = await parseActaPDF(pdfPath);
      console.log('\n=== RESULTADO ===');
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message || err);
      process.exit(1);
    }
  })();
}
