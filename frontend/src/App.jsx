import { Link, NavLink, Route, Routes } from 'react-router';
import { useApi } from './api.js';
import CatalogPage from './pages/CatalogPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function CategoryNav() {
  const { data } = useApi('/categories');
  return (
    <nav className="category-nav" aria-label="Categories">
      <NavLink to="/" end>All products</NavLink>
      {data?.categories.map(category => (
        <NavLink key={category.id} to={`/categories/${category.id}`}>{category.name}</NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  return (
    <>
      <header className="site-header">
        <div className="container header-row">
          <Link to="/" className="logo">Byte<span>Tech</span></Link>
        </div>
        <div className="container">
          <CategoryNav />
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/categories/:categoryId" element={<CatalogPage />} />
          <Route path="/products/:productId" element={<ProductPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container">ByteTech · Prices in RON · Product images are illustrations.</div>
      </footer>
    </>
  );
}
