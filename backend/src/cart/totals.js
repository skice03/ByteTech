import Decimal from 'decimal.js';

const Money = Decimal.clone({ precision: 40 });

export function formatCart(rows) {
  let total = new Money(0), itemCount = 0;
  const items = rows.map(row => {
    const price = new Money(row.price);
    const lineTotal = price.times(row.quantity);
    total = total.plus(lineTotal);
    itemCount += row.quantity;
    return {
      productId: row.productId, name: row.name, imageUrl: row.imageUrl,
      unitPrice: price.toFixed(2), quantity: row.quantity, lineTotal: lineTotal.toFixed(2),
      stockQuantity: row.stockQuantity,
      isAvailable: Boolean(Number(row.productActive) && Number(row.categoryActive) && row.quantity <= row.stockQuantity)
    };
  });
  return { items, itemCount, total: total.toFixed(2), currency: 'RON' };
}
