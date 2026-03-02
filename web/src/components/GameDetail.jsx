import { useState } from 'react';
import StatsTable from './StatsTable';
import './GameDetail.css';

export default function GameDetail({ game, onBack }) {
  const [tab, setTab] = useState('A');
  const equipo = tab === 'A' ? game.equipoA : game.equipoB;

  return (
    <div className="game-detail">
      <button className="back-btn" onClick={onBack}>← Partidos</button>

      <div className="score-header">
        <div className={`score-team ${game.equipoA.totalPuntos > game.equipoB.totalPuntos ? 'winner' : ''}`}>
          <span className="score-name">{game.equipoA?.nombre || 'Equipo A'}</span>
          <span className="score-pts">{game.equipoA?.totalPuntos ?? '?'}</span>
        </div>
        <span className="score-vs">–</span>
        <div className={`score-team ${game.equipoB.totalPuntos > game.equipoA.totalPuntos ? 'winner' : ''}`}>
          <span className="score-pts">{game.equipoB?.totalPuntos ?? '?'}</span>
          <span className="score-name">{game.equipoB?.nombre || 'Equipo B'}</span>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'A' ? 'active' : ''}`}
          onClick={() => setTab('A')}
        >
          {game.equipoA?.nombre || 'Equipo A'}
        </button>
        <button
          className={`tab ${tab === 'B' ? 'active' : ''}`}
          onClick={() => setTab('B')}
        >
          {game.equipoB?.nombre || 'Equipo B'}
        </button>
      </div>

      <StatsTable jugadores={equipo?.jugadores || []} />
    </div>
  );
}
