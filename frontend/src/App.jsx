import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router';
import { apiRequest, apiWrite, useApi } from './api.js';
import ProductSearch from './components/ProductSearch.jsx';
import AccountPage from './pages/AccountPage.jsx';
import CartPage from './pages/CartPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
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

function SignedIn({ user, children }) {
  const location = useLocation();
  if (user === undefined) return <p role="status">Checking your session…</p>;
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [accountError, setAccountError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const expire = () => setUser(null);
    window.addEventListener('bytetech-session-expired', expire);
    apiRequest('/users/me', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setUser(result.user); })
      .catch(error => {
        if (controller.signal.aborted) return;
        setUser(null);
        if (error.status !== 401) setAccountError(error.message);
      });
    return () => {
      controller.abort();
      window.removeEventListener('bytetech-session-expired', expire);
    };
  }, []);

  async function logout() {
    setLoggingOut(true);
    setAccountError('');
    try {
      await apiWrite('POST', '/auth/logout', {});
      setUser(null);
    } catch (error) {
      if (error.status === 401) setUser(null);
      else setAccountError(error.message);
    } finally {
      setLoggingOut(false);
    }
  }
  function login(account) {
    setAccountError('');
    setUser(account);
  }
  return (
    <>
      <header className="site-header">
        <div className="container header-row">
          <Link to="/" className="logo">Byte<span>Tech</span></Link>
          <ProductSearch />
          <nav className="account-nav" aria-label="Shopping and account">
            <Link to="/cart">Cart</Link>
            {user ? <>
              <Link to="/account">Your account</Link>
              <button type="button" disabled={loggingOut} onClick={logout}>Log out</button>
            </> : <Link to="/login">Log in</Link>}
          </nav>
        </div>
        {accountError && <p className="container" role="alert">{accountError}</p>}
        <div className="container">
          <CategoryNav />
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/search" element={<CatalogPage search />} />
          <Route path="/login" element={<LoginPage user={user} onLogin={login} />} />
          <Route path="/account" element={<SignedIn user={user}><AccountPage key={user?.id} user={user} /></SignedIn>} />
          <Route path="/cart" element={<SignedIn user={user}><CartPage key={user?.id} /></SignedIn>} />
          <Route path="/categories/:categoryId" element={<CatalogPage />} />
          <Route path="/products/:productId" element={<ProductPage user={user} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container">ByteTech · Prices in RON · Product images are illustrations.</div>
      </footer>
    </>
  );
}
