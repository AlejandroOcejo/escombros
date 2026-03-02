import './Header.css';

export default function Header({ page, onNav }) {
  return (
    <header className="header">
      <div className="header-top">
        <img className="header-icon" src="/a5e742d8-396f-4fac-9c17-02ae63cc7f9a-removebg-preview.png" alt="Escom-bros" />
        <h1 className="header-title">Escom-bros</h1>
      </div>
      <nav className="header-nav">
        <button
          className={`nav-btn ${page === 'general' ? 'active' : ''}`}
          onClick={() => onNav('general')}
        >
          General
        </button>
        <button
          className={`nav-btn ${page === 'partidos' ? 'active' : ''}`}
          onClick={() => onNav('partidos')}
        >
          Partidos
        </button>
      </nav>
    </header>
  );
}
