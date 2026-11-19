import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiWrite, formatPrice, useApi } from '../api.js';
import Availability from '../components/Availability.jsx';
import Status from '../components/Status.jsx';

function Gallery({ images, name }) {
  const [selected, setSelected] = useState(0);
  if (!images.length) return <div className="gallery-main placeholder" role="img" aria-label={`No image for ${name}`} />;
  const current = images[Math.min(selected, images.length - 1)];
  return (
    <div className="gallery">
      <img className="gallery-main" src={current.url} alt={current.altText} />
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((image, index) => (
            <button key={image.url} type="button" onClick={() => setSelected(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`} aria-pressed={index === selected}>
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddToCart({ product, user }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!product.isAvailable || user === undefined) return null;
  if (!user) return <Link className="primary add-link" to="/login" state={{ from: `/products/${product.id}` }}>Log in to add to cart</Link>;

  async function add(event) {
    event.preventDefault();
    const quantity = Number(event.currentTarget.elements.quantity.value);
    setError('');
    setBusy(true);
    try {
      await apiWrite('POST', '/cart/items', { productId: product.id, quantity });
      navigate('/cart');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }
  return <>
    <form className="line-actions add-item" onSubmit={add}>
      <label>Quantity<input name="quantity" type="number" min="1" max={product.stockQuantity} defaultValue="1" required /></label>
      <button className="primary" disabled={busy}>Add to cart</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
  </>;
}

export default function ProductPage({ user }) {
  const { productId } = useParams();
  const { data, error, loading } = useApi(`/products/${productId}`);
  const product = data?.product;
  useEffect(() => { if (product) document.title = `${product.name} · ByteTech`; }, [product]);
  useEffect(() => { window.scrollTo(0, 0); }, [productId]);

  if (error) {
    return (
      <Status title={error.status === 404 || error.status === 400 ? 'Product not found' : 'Could not load this product'}>
        <p>{error.message}</p>
        <Link to="/">Back to all products</Link>
      </Status>
    );
  }
  if (!product || loading) return <p className="muted">Loading product…</p>;

  return (
    <article className="product-detail">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">All products</Link> <span aria-hidden="true">›</span>{' '}
        <Link to={`/categories/${product.category.id}`}>{product.category.name}</Link>
      </nav>
      <div className="product-layout">
        <Gallery key={product.id} images={product.images} name={product.name} />
        <div className="product-info">
          <h1>{product.name}</h1>
          <p className="price large">{formatPrice(product.price)}</p>
          <Availability product={product} detailed />
          <AddToCart key={`${product.id}-${user?.id ?? 'guest'}`} product={product} user={user} />
          <h2>Description</h2>
          <p className="description">{product.description}</p>
        </div>
      </div>
    </article>
  );
}
