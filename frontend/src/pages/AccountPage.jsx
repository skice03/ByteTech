import { useEffect, useState } from 'react';
import { apiWrite, useApi } from '../api.js';

const fields = [
  ['recipientName', 'Recipient name', 'name', 200], ['phone', 'Phone', 'tel', 32],
  ['addressLine', 'Street address', 'street-address', 255], ['city', 'City', 'address-level2', 100],
  ['region', 'County or region', 'address-level1', 100], ['postalCode', 'Postal code', 'postal-code', 20]
];

export default function AccountPage({ user }) {
  const addresses = useApi('/addresses');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Your account · ByteTech'; }, []);

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSaving(true);
    setFeedback('');
    setError('');
    try {
      const { address } = await apiWrite('POST', '/addresses', data);
      const others = addresses.data.addresses.filter(item => item.id !== address.id);
      addresses.replaceData({ addresses: [...others, address] });
      form.reset();
      setFeedback('Delivery address saved.');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section>
      <div className="page-heading"><h1>Your account</h1><span>{user.firstName} {user.lastName} · {user.email}</span></div>
      <div className="account-layout">
        <section className="panel">
          <h2>Saved delivery addresses</h2>
          {addresses.loading && <p role="status">Loading addresses…</p>}
          {addresses.error && <p role="alert">{addresses.error.message}</p>}
          {addresses.data?.addresses.length === 0 && <p>You have no saved addresses yet.</p>}
          {addresses.data?.addresses.map(address => <address key={address.id}>
            <strong>{address.recipientName}</strong><br />{address.addressLine}<br />
            {address.city}, {address.region} {address.postalCode}<br />{address.phone}
          </address>)}
        </section>
        <section className="panel">
          <h2>Add a delivery address</h2>
          <form className="fields" method="post" onSubmit={save}>
            {fields.map(([name, label, autoComplete, maxLength]) => <label key={name}>{label}
              <input name={name} autoComplete={autoComplete} type={name === 'phone' ? 'tel' : 'text'}
                maxLength={maxLength} required />
            </label>)}
            <button className="primary" disabled={saving || !addresses.data}>Save address</button>
          </form>
          {feedback && <p role="status">{feedback}</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      </div>
    </section>
  );
}
