import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiWrite, formatPrice, useApi } from '../api.js';

export default function CartPage() {
  const { data, error, loading, replaceData } = useApi('/cart');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  useEffect(() => { document.title = 'Shopping cart · ByteTech'; }, []);

  async function change(method, id, quantity) {
    setBusy(true);
    setProblem('');
    try {
      const body = quantity === undefined ? undefined : { quantity };
      const result = await apiWrite(method, `/cart/items/${id}`, body);
      replaceData(result);
    } catch (failure) {
      setProblem(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const cart = data?.cart;
  return (
    <section>
      <div className="page-heading"><h1>Shopping cart</h1><Link to="/">Continue shopping</Link></div>
      {loading && <p role="status">Loading cart…</p>}
      {(error || problem) && <p className="error" role="alert">{error?.message || problem}</p>}
      {cart?.items.length === 0 && <p className="panel">Your cart is empty.</p>}
      {cart && cart.items.length > 0 && <>
        <ul className="cart-lines">{cart.items.map(item => <li className="panel cart-line" key={item.productId}>
          {item.imageUrl && <img src={item.imageUrl} alt="" />}
          <div className="line-info">
            <Link to={`/products/${item.productId}`}>{item.name}</Link>
            <p>{formatPrice(item.unitPrice)} each</p>
            {!item.isAvailable && <p className="error">This quantity is no longer available. Update or remove this item.</p>}
          </div>
          <form className="line-actions" onSubmit={event => {
            event.preventDefault();
            change('PATCH', item.productId, Number(event.currentTarget.elements.quantity.value));
          }}>
            <label>Quantity<input key={item.quantity} name="quantity" type="number" required min="1"
              max={item.stockQuantity} defaultValue={item.quantity} aria-label={`Quantity for ${item.name}`} /></label>
            <button disabled={busy}>Update</button>
            <button type="button" disabled={busy} onClick={() => change('DELETE', item.productId)}>Remove</button>
          </form>
          <strong className="line-total">{formatPrice(item.lineTotal)}</strong>
        </li>)}</ul>
        <p className="cart-total" aria-live="polite">Total <strong>{formatPrice(cart.total)}</strong></p>
      </>}
    </section>
  );
}
