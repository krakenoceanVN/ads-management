import React from 'react';
import { login } from '../lib/bffApi';

export function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
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
    <div className="login-page">
      {/* Decorative background orbs */}
      <div className="login-bg">
        <span className="login-orb login-orb-1"></span>
        <span className="login-orb login-orb-2"></span>
        <span className="login-orb login-orb-3"></span>
        <span className="login-orb login-orb-4"></span>
        <span className="login-grid"></span>
      </div>

      <div className="login-shell">

        {/* LEFT — Brand panel */}
        <aside className="login-brand-panel">
          <div className="login-brand-logo">
            <img src="/logo.jpg" alt="KrakenOcean logo" />
            <div>
              <span className="login-brand-title">KrakenOcean</span>
              <span className="login-brand-sub">Ads Management Platform</span>
            </div>
          </div>

          <div className="login-brand-hero">
            <h2>Manage campaigns,<br />revenue, and performance<br />in one secure workspace.</h2>
            <p>The all-in-one advertising management platform for modern media teams.</p>
          </div>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <strong>Campaign Operations</strong>
                <span>Manage ad orders, media planning, and daily data entry</span>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
                </svg>
              </div>
              <div>
                <strong>Revenue Insights</strong>
                <span>Real-time profit reports, settlement, and financial dashboards</span>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div>
                <strong>Role-Based Access</strong>
                <span>Granular permissions, audit logs, and secure team management</span>
              </div>
            </div>
          </div>

          <div className="login-brand-footer">
            <span>© 2026 KrakenOcean</span>
            <span>Secure Admin Access</span>
          </div>
        </aside>

        {/* RIGHT — Login form */}
        <section className="login-form-panel">
          <div className="login-card">
            <div className="login-card-header">
              <div className="login-card-logo">
                <img src="/logo.jpg" alt="KrakenOcean logo" />
              </div>
              <h1>Welcome back</h1>
              <p>Sign in to continue to KrakenOcean</p>
            </div>

            <form className="login-form" onSubmit={submit} noValidate>
              <div className="login-field">
                <label htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  type="text"
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
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-error" role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login-spinner"></span>
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="login-card-footer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Secure admin access — KrakenOcean Ads Management
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}