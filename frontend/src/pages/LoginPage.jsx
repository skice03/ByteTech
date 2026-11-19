import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { apiWrite } from '../api.js';

export default function LoginPage({ user, onLogin }) {
  const { state } = useLocation();
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = registering ? 'Create an account' : 'Log in';
  useEffect(() => { document.title = `${title} · ByteTech`; }, [title]);

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (registering) {
        await apiWrite('POST', '/auth/register', data);
        setRegistering(false);
        setNotice('Account created. Log in to continue.');
      } else {
        const result = await apiWrite('POST', '/auth/login', data);
        onLogin(result.user);
      }
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) return <p role="status">Checking your session…</p>;
  if (user) {
    const from = state?.from;
    const destination = typeof from === 'string' && /^\/(cart|account|products\/\d+)$/.test(from) ? from : '/account';
    return <Navigate to={destination} replace />;
  }
  return (
    <section className="panel login-panel">
      <h1>{title}</h1>
      {notice && <p role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <form key={title} className="fields" method="post" onSubmit={submit}>
        {registering && <>
          <label>First name<input name="firstName" autoComplete="given-name" required maxLength={100} /></label>
          <label>Last name<input name="lastName" autoComplete="family-name" required maxLength={100} /></label>
        </>}
        <label>Email<input type="email" name="email" autoComplete="username" required maxLength={254}
          value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" name="password" required minLength={registering ? 15 : 1}
          autoComplete={registering ? 'new-password' : 'current-password'} aria-describedby={registering ? 'password-hint' : undefined} /></label>
        {registering && <small id="password-hint">Use 15 to 128 characters.</small>}
        <button className="primary" disabled={busy}>{title}</button>
      </form>
      <button className="text-button" type="button" disabled={busy} onClick={() => {
        setRegistering(!registering); setError(''); setNotice('');
      }}>{registering ? 'Back to log in' : 'Create an account'}</button>
    </section>
  );
}
