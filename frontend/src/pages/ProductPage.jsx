import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatPrice, useApi } from '../api.js';
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

export default function ProductPage() {
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
          <h2>Description</h2>
          <p className="description">{product.description}</p>
        </div>
      </div>
    </article>
  );
}
