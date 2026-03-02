import { useState, useEffect } from 'react';
import Header from './components/Header';
import GameCard from './components/GameCard';
import GameDetail from './components/GameDetail';
import GlobalStats from './components/GlobalStats';
import './App.css';

export default function App() {
  const [games, setGames] = useState([]);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState('general'); // 'general' | 'partidos'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/games.json')
      .then(res => {
        if (!res.ok) throw new Error('No se encontraron datos');
        return res.json();
      })
      .then(data => {
        setGames(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleNav = (p) => {
    setPage(p);
    setSelected(null);
  };

  return (
    <div className="app">
      <Header page={page} onNav={handleNav} />
      <main className="main">
        {loading && <p className="status">Cargando datos...</p>}
        {error && <p className="status error">{error}</p>}
        {!loading && !error && games.length === 0 && (
          <p className="status">No hay partidos disponibles</p>
        )}

        {!loading && !error && games.length > 0 && page === 'general' && (
          <GlobalStats games={games} />
        )}

        {!loading && !error && games.length > 0 && page === 'partidos' && (
          selected ? (
            <GameDetail game={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="games-grid">
              {games.map((game, i) => (
                <GameCard key={i} game={game} onClick={() => setSelected(game)} />
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
