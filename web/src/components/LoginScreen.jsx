import { useState } from 'react';
import './LoginScreen.css';

export default function LoginScreen({ onAuth }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Comparar contra hash SHA-256 de la contraseña
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash === 'd11f2f552025249bd58c9fbfc7959d0783a7dd2a54cfb1f6693c8554ba2b9906') {
      localStorage.setItem('escombot-auth', 'ok');
      onAuth();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <img className="login-logo" src="/a5e742d8-396f-4fac-9c17-02ae63cc7f9a-removebg-preview.png" alt="Escom-bros" />
        <h1 className="login-title">Escom-bros</h1>
        <form onSubmit={handleSubmit}>
          <input
            className={`login-input ${error ? 'shake' : ''}`}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className="login-btn" type="submit">Entrar</button>
        </form>
        {error && <p className="login-error">Contraseña incorrecta</p>}
      </div>
    </div>
  );
}
