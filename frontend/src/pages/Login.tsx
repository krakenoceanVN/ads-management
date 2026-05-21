import React from 'react';
import { login } from '../lib/bffApi';

export function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login({ username: username.trim(), password });
      if (!response.token) {
        setError(response.error || 'Login failed');
        return;
      }
      onLogin(response.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="login-logo">K</div>
          <div>
            <h1>KrakenOcean</h1>
            <p>Ads Management</p>
          </div>
        </div>

        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          autoComplete="username"
          value={username}
          onChange={event => setUsername(event.target.value)}
          disabled={loading}
          required
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          disabled={loading}
          required
        />

        {error && <div className="form-error">{error}</div>}

        <button className="btn-primary login-submit" type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </main>
  );
}
