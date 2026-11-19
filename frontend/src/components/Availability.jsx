export default function Availability({ product, detailed = false }) {
  if (!product.isAvailable) return <p className="availability out">Out of stock</p>;
  return (
    <p className="availability in">
      In stock{detailed && `: ${product.stockQuantity} ${product.stockQuantity === 1 ? 'unit' : 'units'} available`}
    </p>
  );
}
