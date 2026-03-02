import './StatsTable.css';

const columns = [
  { key: 'dorsal', label: '#', align: 'center' },
  { key: 'nombre', label: 'Jugador', align: 'left' },
  { key: 'puntos', label: 'PTS', align: 'center' },
  { key: 'triples', label: '3PT', align: 'center' },
  { key: 'tlAnotados', label: 'TL', align: 'center' },
  { key: 'tlIntentados', label: 'TLI', align: 'center' },
  { key: 'tlPct', label: 'TL%', align: 'center' },
];

export default function StatsTable({ jugadores }) {
  if (!jugadores.length) {
    return <p className="no-data">Sin datos de jugadores</p>;
  }

  // Totales
  const totals = {
    puntos: jugadores.reduce((s, j) => s + (j.puntos || 0), 0),
    triples: jugadores.reduce((s, j) => s + (j.triples || 0), 0),
    tlAnotados: jugadores.reduce((s, j) => s + (j.tlAnotados || 0), 0),
    tlIntentados: jugadores.reduce((s, j) => s + (j.tlIntentados || 0), 0),
  };
  totals.tlPct = totals.tlIntentados > 0
    ? Math.round((totals.tlAnotados / totals.tlIntentados) * 100) + '%'
    : '-';

  return (
    <div className="table-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className={`align-${col.align}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jugadores.map((j, i) => (
            <tr key={i} className={j.eliminado ? 'fouled-out' : ''}>
              {columns.map(col => (
                <td key={col.key} className={`align-${col.align}`}>
                  {col.key === 'nombre' ? (
                    j.nombre
                  ) : (
                    j[col.key] ?? '-'
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="align-center"></td>
            <td className="align-left"><strong>TOTAL</strong></td>
            {columns.slice(2).map(col => (
              <td key={col.key} className={`align-${col.align}`}>
                <strong>{totals[col.key] ?? '-'}</strong>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
