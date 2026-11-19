import { withTransaction } from '../database.js';
import { HttpError } from '../errors.js';

async function cartRows(connection, userId) {
  const [rows] = await connection.execute(`SELECT p.id AS productId, p.name, p.price, item.quantity,
    p.stock_quantity AS stockQuantity, p.is_active AS productActive, category.is_active AS categoryActive,
    (SELECT image.url FROM product_images image WHERE image.product_id = p.id ORDER BY image.sort_order, image.id LIMIT 1) AS imageUrl
    FROM cart_items item JOIN products p ON p.id = item.product_id
    JOIN categories category ON category.id = p.category_id WHERE item.user_id = ? ORDER BY p.id`, [userId]);
  return rows;
}

export function createCartStore(db) {
  return {
    listCart(userId) { return cartRows(db, userId); },
    async changeQuantity(userId, productId, quantity, mode) {
      return withTransaction(db, async connection => {
        // Lock the product before its cart row. Concurrent additions to the same
        // product are serialized, so the stock check uses the resulting quantity.
        const [products] = await connection.execute(`SELECT p.stock_quantity AS stockQuantity,
          p.is_active AS productActive, category.is_active AS categoryActive
          FROM products p JOIN categories category ON category.id = p.category_id WHERE p.id = ? FOR UPDATE`, [productId]);
        if (!products.length) throw new HttpError(404, 'Product not found.');
        const product = products[0];
        if (!Number(product.productActive) || !Number(product.categoryActive)) throw new HttpError(409, 'Product is not available.');
        const [current] = await connection.execute('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ? FOR UPDATE', [userId, productId]);
        if (mode === 'replace' && !current.length) throw new HttpError(404, 'Product is not in your cart.');
        const next = mode === 'add' ? (current[0]?.quantity ?? 0) + quantity : quantity;
        if (next > product.stockQuantity) throw new HttpError(409, 'Quantity exceeds available stock.');
        await connection.execute(`INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE quantity = ?`, [userId, productId, next, next]);
        return cartRows(connection, userId);
      });
    },
    async removeItem(userId, productId) {
      return withTransaction(db, async connection => {
        await connection.execute('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId]);
        return cartRows(connection, userId);
      });
    }
  };
}
