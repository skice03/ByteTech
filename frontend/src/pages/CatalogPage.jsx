import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApi } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';
import Status from '../components/Status.jsx';

// Lists all products ("/") or one category ("/categories/:categoryId"), 24 per page.
export default function CatalogPage() {
  const { categoryId } = useParams();
  const [searchParams] = useSearchParams();
  const page = /^[1-9]\d*$/.test(searchParams.get('page') ?? '') ? Number(searchParams.get('page')) : 1;

  const query = new URLSearchParams();
  if (categoryId) query.set('categoryId', categoryId);
  if (page > 1) query.set('page', String(page));
  const products = useApi(`/products${query.size ? `?${query}` : ''}`);
  const category = useApi(categoryId ? `/categories/${categoryId}` : null);

  const title = categoryId ? category.data?.category.name ?? 'Category' : 'All products';
  useEffect(() => { document.title = `${title} · ByteTech`; }, [title]);
  useEffect(() => { window.scrollTo(0, 0); }, [categoryId, page]);

  if (products.error) {
    return (
      <Status title={categoryId && [400, 404].includes(products.error.status) ?'Category not found' : 'Could not load products'}>
        <p>{products.error.message}</p>
        <Link to="/">Back to all products</Link>
      </Status>
    );
  }

  const data = products.data;
  const pagination = data?.pagination;
  const basePath = categoryId ? `/categories/${categoryId}` : '/';
  return (
    <section aria-busy={products.loading}>
      <div className="page-heading">
        <h1>{title}</h1>
        {pagination && <p className="muted">{pagination.totalItems} {pagination.totalItems === 1 ? 'product' : 'products'}</p>}
      </div>
      {!data && products.loading && <p className="muted">Loading products…</p>}
      {data && data.products.length === 0 && (
        <Status title="No products here">
          <p>{page > 1 ? 'This page is past the end of the list.' : 'This category has no products yet.'}</p>
          <Link to={basePath}>Go to the first page</Link>
        </Status>
      )}
      {data && data.products.length > 0 && (
        <>
          <ul className="product-grid">
            {data.products.map(product => <li key={product.id}><ProductCard product={product} /></li>)}
          </ul>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath={basePath} />
        </>
      )}
    </section>
  );
}
