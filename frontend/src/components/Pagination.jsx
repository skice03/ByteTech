import { Link } from 'react-router';

function pageLink(basePath, page) {
  if (page === 1) return basePath;
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}page=${page}`;
}

export default function Pagination({ page, totalPages, basePath }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav className="pagination" aria-label="Pages">
      {page > 1 ? <Link to={pageLink(basePath, page - 1)}>‹ Previous</Link> : <span className="disabled">‹ Previous</span>}
      {pages.map(number => (number === page
        ? <span key={number} className="current" aria-current="page">{number}</span>
        : <Link key={number} to={pageLink(basePath, number)}>{number}</Link>))}
      {page < totalPages ? <Link to={pageLink(basePath, page + 1)}>Next ›</Link> : <span className="disabled">Next ›</span>}
    </nav>
  );
}
