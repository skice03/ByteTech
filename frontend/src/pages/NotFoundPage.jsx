import { Link } from 'react-router';
import Status from '../components/Status.jsx';

export default function NotFoundPage() {
  return (
    <Status title="Page not found">
      <p>The page you are looking for does not exist.</p>
      <Link to="/">Back to all products</Link>
    </Status>
  );
}
