import React from 'react';
import { login } from '../lib/bffApi';

export function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

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
      {/* Decorative background orbs */}
      <span className="login-orb login-orb-1" aria-hidden="true" />
      <span className="login-orb login-orb-2" aria-hidden="true" />
      <span className="login-orb login-orb-3" aria-hidden="true" />

      <div className="login-layout">
        {/* Left brand panel */}
        <aside className="login-brand-panel" aria-hidden="true">
          <div className="login-brand-panel-inner">
            <div className="login-brand-logo">
              <img src="/logo.jpg" alt="KrakenOcean logo" />
            </div>
            <h2 className="login-brand-name">KrakenOcean</h2>
            <p className="login-brand-sub">Ads Management Platform</p>
            <p className="login-brand-tagline">
              Manage campaigns, revenue, and performance<br />
              in one secure workspace.
            </p>

            <div className="login-feature-list">
              <div className="login-feature-item">
                <span className="login-feature-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </span>
                <span>Campaign Operations</span>
              </div>
              <div className="login-feature-item">
                <span className="login-feature-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </span>
                <span>Revenue Insights</span>
              </div>
              <div className="login-feature-item">
                <span className="login-feature-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
                <span>Role-Based Access</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right login form panel */}
        <section className="login-form-panel">
          <form className="login-card" onSubmit={submit} noValidate>
            <div className="login-card-header">
              <div className="login-card-logo">
                <img src="/logo.jpg" alt="KrakenOcean logo" />
              </div>
              <h1 className="login-card-title">Welcome back</h1>
              <p className="login-card-subtitle">Sign in to continue to KrakenOcean</p>
            </div>

            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                className="login-input"
                autoComplete="username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                disabled={loading}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  className="login-input login-input-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  disabled={loading}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}

            <button
              className="login-submit-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>

            <p className="login-secure-note">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Secure admin access — KrakenOcean Ads Management
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}