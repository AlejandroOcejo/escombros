import './GlobalStats.css';

const columns = [
  { key: 'dorsal', label: '#', align: 'center' },
  { key: 'nombre', label: 'Jugador', align: 'left' },
  { key: 'partidos', label: 'PJ', align: 'center' },
  { key: 'puntos', label: 'PTS', align: 'center' },
  { key: 'ppg', label: 'PPG', align: 'center' },
  { key: 'triples', label: '3PT', align: 'center' },
  { key: 'tlAnotados', label: 'TL', align: 'center' },
  { key: 'tlIntentados', label: 'TLI', align: 'center' },
  { key: 'tlPct', label: 'TL%', align: 'center' },
];

function aggregateStats(games) {
  const players = {};

  for (const game of games) {
    // Find which side is Escom-Bros
    const escomIsA = /escom/i.test(game.equipoA?.nombre || '');
    const escomTeam = escomIsA ? game.equipoA : game.equipoB;

    for (const j of escomTeam?.jugadores || []) {
      const key = j.dorsal;
      if (!players[key]) {
        players[key] = {
          dorsal: j.dorsal,
          nombre: j.nombre,
          partidos: 0,
          puntos: 0,
          triples: 0,
          tlAnotados: 0,
          tlIntentados: 0,
        };
      }
      players[key].partidos += 1;
      players[key].puntos += j.puntos || 0;
      players[key].triples += j.triples || 0;
      players[key].tlAnotados += j.tlAnotados || 0;
      players[key].tlIntentados += j.tlIntentados || 0;
      // Keep the latest name in case it varies
      if (j.nombre) players[key].nombre = j.nombre;
    }
  }

  // Calculate derived stats
  return Object.values(players)
    .map((p) => ({
      ...p,
      ppg: p.partidos > 0 ? (p.puntos / p.partidos).toFixed(1) : '0',
      tlPct: p.tlIntentados > 0 ? Math.round((p.tlAnotados / p.tlIntentados) * 100) + '%' : '-',
    }))
    .sort((a, b) => b.puntos - a.puntos);
}

function teamRecord(games) {
  let wins = 0,
    losses = 0,
    pf = 0,
    pa = 0;
  for (const game of games) {
    const escomIsA = /escom/i.test(game.equipoA?.nombre || '');
    const escomPts = escomIsA ? game.equipoA.totalPuntos : game.equipoB.totalPuntos;
    const oppPts = escomIsA ? game.equipoB.totalPuntos : game.equipoA.totalPuntos;
    pf += escomPts || 0;
    pa += oppPts || 0;
    if (escomPts > oppPts) wins++;
    else losses++;
  }
  return { wins, losses, pf, pa, games: games.length };
}

export default function GlobalStats({ games }) {
  if (!games.length) {
    return <p className="no-data">Sin datos de partidos</p>;
  }

  const players = aggregateStats(games);
  const record = teamRecord(games);

  const totals = {
    partidos: record.games,
    puntos: players.reduce((s, p) => s + p.puntos, 0),
    triples: players.reduce((s, p) => s + p.triples, 0),
    tlAnotados: players.reduce((s, p) => s + p.tlAnotados, 0),
    tlIntentados: players.reduce((s, p) => s + p.tlIntentados, 0),
  };
  totals.ppg = totals.partidos > 0 ? (totals.puntos / totals.partidos).toFixed(1) : '0';
  totals.tlPct =
    totals.tlIntentados > 0
      ? Math.round((totals.tlAnotados / totals.tlIntentados) * 100) + '%'
      : '-';

  return (
    <div className="global-stats">
      <div className="record-cards">
        <div className="record-card">
          <div className="record-value">
            {record.wins}-{record.losses + 1}
          </div>
          <div className="record-label">Balance</div>
        </div>
        <div className="record-card">
          <div className="record-value">{totals.ppg}</div>
          <div className="record-label">Pts/partido</div>
        </div>
        <div className="record-card">
          <div className="record-value">
            {record.games > 0 ? (record.pa / record.games).toFixed(1) : '0'}
          </div>
          <div className="record-label">Pts en contra</div>
        </div>
        <div className="record-card">
          <div className="record-value">{totals.tlPct}</div>
          <div className="record-label">TL%</div>
        </div>
      </div>

      <h2 className="section-title">Estadísticas por jugador</h2>

      <div className="table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`align-${col.align}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className={`align-${col.align}`}>
                    {p[col.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="align-center"></td>
              <td className="align-left">
                <strong>TOTAL</strong>
              </td>
              {columns.slice(2).map((col) => (
                <td key={col.key} className={`align-${col.align}`}>
                  <strong>{totals[col.key] ?? '-'}</strong>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
