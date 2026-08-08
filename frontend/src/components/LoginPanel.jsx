import React, { useState } from 'react';
import { login } from '../api/authApi';
import { setAccessToken } from '../api/client';

// Login card shown by pages that need an authenticated user
// (currently UC-003's payroll page). Kept as its own component so it can
// graduate to a shared Login page when auth is rolled out to every screen.
function LoginPanel({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const result = await login({ email, password });
      setAccessToken(result.accessToken);
      setBusy(false);
      onLoggedIn(result.user);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Login failed.');
      setBusy(false);
    }
  }

  return (
    <div className="card login-card">
      <div className="card-header">
        <h2>Log in</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field-column">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field-column">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>

        {message && (
          <div className="banner error-banner">
            <span className="banner-icon" aria-hidden="true">
              ⨯
            </span>
            <span>{message}</span>
          </div>
        )}

        <div className="button-row">
          <button className="primary" type="submit" disabled={busy}>
            {busy && <span className="spinner" />}
            Log in
          </button>
        </div>
      </form>
    </div>
  );
}

export default LoginPanel;
