// Public catalog reads. Only active products in active categories are visible.
const visible = 'p.is_active = TRUE AND c.is_active = TRUE';
const firstImage = (column, alias) => `(SELECT image.${column} FROM product_images image WHERE image.product_id = p.id
  ORDER BY image.sort_order, image.id LIMIT 1) AS ${alias}`;

export function createCatalogStore(db) {
  return {
    async listCategories() {
      const [rows] = await db.execute(`SELECT c.id, c.name, COUNT(p.id) AS productCount FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
        WHERE c.is_active = TRUE GROUP BY c.id, c.name ORDER BY c.name`);
      return rows.map(row => ({ ...row, productCount: Number(row.productCount) }));
    },
    async findCategory(categoryId) {
      const [rows] = await db.execute('SELECT id, name FROM categories WHERE id = ? AND is_active = TRUE', [categoryId]);
      return rows[0] ?? null;
    },
    async listProducts({ categoryId, searchTerm, limit, offset }) {
      const conditions = [visible];
      const params = [];
      if (categoryId) {
        conditions.push('p.category_id = ?');
        params.push(categoryId);
      }
      if (searchTerm) {
        // LOCATE uses the name's case-insensitive collation and treats % and _ literally.
        conditions.push('LOCATE(?, p.name) > 0');
        params.push(searchTerm);
      }
      const from = `FROM products p JOIN categories c ON c.id = p.category_id WHERE ${conditions.join(' AND ')}`;
      const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total ${from}`, params);
      // mysql2 prepared statements need LIMIT/OFFSET values as strings.
      const [rows] = await db.execute(`SELECT p.id, p.name, p.price, p.stock_quantity AS stockQuantity,
        c.id AS categoryId, c.name AS categoryName, ${firstImage('url', 'imageUrl')}, ${firstImage('alt_text', 'imageAlt')}
        ${from} ORDER BY p.id LIMIT ? OFFSET ?`, [...params, String(limit), String(offset)]);
      return { rows, total: Number(total) };
    },
    async findProduct(productId) {
      const [rows] = await db.execute(`SELECT p.id, p.name, p.description, p.price, p.stock_quantity AS stockQuantity,
        c.id AS categoryId, c.name AS categoryName
        FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND ${visible}`, [productId]);
      if (!rows.length) return null;
      const [images] = await db.execute(`SELECT url, alt_text AS altText FROM product_images
        WHERE product_id = ? ORDER BY sort_order, id`, [productId]);
      return { ...rows[0], images };
    }
  };
}
