import React, { useState } from 'react';
import { loginUser, registerUser, storeAccessToken } from '../api/client';

// Login/register card shown by pages that need an authenticated user
// (currently UC-003's payroll page). Kept as its own component so it can
// graduate to a shared Login page when auth is rolled out to every screen.
function LoginPanel({ onLoggedIn }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('accounting');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    if (mode === 'register') {
      const registered = await registerUser({ name, email, password, role });
      if (!registered.ok) {
        setMessage(registered.data?.message || 'Registration failed.');
        setBusy(false);
        return;
      }
      // Registration succeeded — fall through and log straight in.
    }

    const result = await loginUser({ email, password });
    if (!result.ok) {
      setMessage(result.data?.message || 'Login failed.');
      setBusy(false);
      return;
    }

    storeAccessToken(result.data.accessToken);
    setBusy(false);
    onLoggedIn(result.data.user);
  }

  return (
    <div className="card login-card">
      <div className="card-header">
        <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <>
            <div className="field-column">
              <label htmlFor="login-name">Name</label>
              <input
                id="login-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="field-column">
              <label htmlFor="login-role">Role</label>
              <select id="login-role" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="accounting">Accounting Staff</option>
                <option value="manager">Managing Director / Manager</option>
              </select>
            </div>
          </>
        )}

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
            {mode === 'login' ? 'Log in' : 'Register & log in'}
          </button>
          <button
            type="button"
            className="login-switch"
            onClick={() => {
              setMode((current) => (current === 'login' ? 'register' : 'login'));
              setMessage(null);
            }}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default LoginPanel;
