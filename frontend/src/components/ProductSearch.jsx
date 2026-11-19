import { useNavigate, useSearchParams } from 'react-router';

export default function ProductSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currentTerm = params.get('q') ?? '';

  function submit(event) {
    event.preventDefault();
    const input = event.currentTarget.elements.q;
    const term = input.value.trim();
    input.value = term;
    navigate(term ? `/search?${new URLSearchParams({ q: term })}` : '/');
  }
  return (
    <form role="search" className="product-search" action="/search" onSubmit={submit}>
      <input key={currentTerm} type="search" name="q" aria-label="Search products by name"
        placeholder="Search products by name" defaultValue={currentTerm} maxLength={200} />
      <button type="submit">Search</button>
    </form>
  );
}
