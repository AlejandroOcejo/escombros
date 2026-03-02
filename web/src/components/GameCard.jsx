import './GameCard.css';

function isEscom(name) {
  return /escom/i.test(name || '');
}

export default function GameCard({ game, onClick }) {
  const scoreA = game.equipoA?.totalPuntos ?? '?';
  const scoreB = game.equipoB?.totalPuntos ?? '?';
  const wonA = scoreA > scoreB;
  const wonB = scoreB > scoreA;

  // Determine if Escom-Bros won or lost
  const escomIsA = isEscom(game.equipoA?.nombre);
  const escomWon = (escomIsA && wonA) || (!escomIsA && wonB);
  const resultClass = escomWon ? 'escom-win' : 'escom-loss';

  return (
    <div className={`game-card ${resultClass}`} onClick={onClick}>
      <div className="game-card-teams">
        <div className={`team-row ${wonA ? 'winner' : ''}`}>
          <span className="team-name">{game.equipoA?.nombre || 'Equipo A'}</span>
          <span className="team-score">{scoreA}</span>
        </div>
        <div className={`team-row ${wonB ? 'winner' : ''}`}>
          <span className="team-name">{game.equipoB?.nombre || 'Equipo B'}</span>
          <span className="team-score">{scoreB}</span>
        </div>
      </div>
      {game.fecha && <div className="game-card-date">{game.fecha}</div>}
    </div>
  );
}
