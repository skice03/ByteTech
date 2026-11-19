import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useApi } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';
import Status from '../components/Status.jsx';

export default function CatalogPage({ search = false }) {
  const { categoryId } = useParams();
  const [searchParams] = useSearchParams();
  const term = search ? (searchParams.get('q') ?? '').trim() : '';
  const page = /^[1-9]\d*$/.test(searchParams.get('page') ?? '') ? Number(searchParams.get('page')) : 1;

  const query = new URLSearchParams();
  if (term) query.set('q', term);
  if (categoryId) query.set('categoryId', categoryId);
  if (page > 1) query.set('page', String(page));
  const endpoint = term ? '/products/search' : '/products';
  const products = useApi(`${endpoint}${query.size ? `?${query}` : ''}`);
  const category = useApi(categoryId ? `/categories/${categoryId}` : null);

  let title = 'All products';
  let basePath = '/';
  if (categoryId) {
    title = category.data?.category.name ?? 'Category';
    basePath = `/categories/${categoryId}`;
  } else if (term) {
    title = `Results for “${term}”`;
    basePath = `/search?${new URLSearchParams({ q: term })}`;
  }
  useEffect(() => { document.title = `${title} · ByteTech`; }, [title]);
  useEffect(() => { window.scrollTo(0, 0); }, [categoryId, term, page]);

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
  return (
    <section aria-busy={products.loading}>
      <div className="page-heading">
        <h1>{title}</h1>
        {pagination && <p className="muted">{pagination.totalItems} {pagination.totalItems === 1 ? 'product' : 'products'}</p>}
      </div>
      {!data && products.loading && <p className="muted">Loading products…</p>}
      {data && data.products.length === 0 && (
        <Status title={term && page === 1 ? 'No matching products' : 'No products here'}>
          {page > 1 ? <Link to={basePath}>Go to the first page</Link> : (
            <>
              <p>{term ? 'Try another product name.' : 'There are no products to display.'}</p>
              <Link to="/">Browse all products</Link>
            </>
          )}
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
