export default function Status({ title, children }) {
  return (
    <div className="status" role="status">
      <h1>{title}</h1>
      {children}
    </div>
  );
}
