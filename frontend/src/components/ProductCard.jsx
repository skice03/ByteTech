import { Link } from 'react-router';
import { formatPrice } from '../api.js';
import Availability from './Availability.jsx';

export default function ProductCard({ product }) {
  return (
    <Link to={`/products/${product.id}`} className="product-card">
      {product.image
        ? <img src={product.image.url} alt={product.image.altText} loading="lazy" width="800" height="600" />
        : <div className="placeholder" aria-hidden="true" />}
      <div className="product-card-body">
        <span className="muted small">{product.category.name}</span>
        <h2>{product.name}</h2>
        <p className="price">{formatPrice(product.price)}</p>
        <Availability product={product} />
      </div>
    </Link>
  );
}
