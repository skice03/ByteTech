import { pathToFileURL } from 'node:url';
import { readConfig } from '../src/config.js';
import { createDatabase, withTransaction } from '../src/database.js';
import { catalog } from '../seed/catalog.js';

// Repeatable: categories are matched by their unique name and products by name, so
// running the seed again updates the same rows (and resets demo stock) instead of
// adding duplicates. Existing product IDs, carts and extra images are preserved.
export async function seedCatalog(db) {
  return withTransaction(db, async connection => {
    let products = 0, images = 0;
    for (const category of catalog) {
      const [result] = await connection.execute(`INSERT INTO categories (name, is_active) VALUES (?, TRUE)
        ON DUPLICATE KEY UPDATE is_active = TRUE, id = LAST_INSERT_ID(id)`, [category.name]);
      const categoryId = result.insertId;
      for (const item of category.products) {
        const [existing] = await connection.execute('SELECT id FROM products WHERE name = ? ORDER BY id LIMIT 1 FOR UPDATE', [item.name]);
        let productId = existing[0]?.id;
        if (productId) {
          await connection.execute(`UPDATE products SET category_id = ?, description = ?, price = ?, stock_quantity = ?,
            is_active = TRUE WHERE id = ?`, [categoryId, item.description, item.price, item.stockQuantity, productId]);
        } else {
          const [inserted] = await connection.execute(`INSERT INTO products (category_id, name, description, price, stock_quantity, is_active)
            VALUES (?, ?, ?, ?, ?, TRUE)`, [categoryId, item.name, item.description, item.price, item.stockQuantity]);
          productId = inserted.insertId;
        }
        products++;
        for (const [sortOrder, image] of item.images.entries()) {
          await connection.execute(`INSERT INTO product_images (product_id, url, alt_text, sort_order) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE url = ?, alt_text = ?`, [productId, image.url, image.altText, sortOrder, image.url, image.altText]);
          images++;
        }
      }
    }
    return { categories: catalog.length, products, images };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDatabase(readConfig().database);
  try {
    const counts = await seedCatalog(db);
    console.info(`Catalog seeded: ${counts.categories} categories, ${counts.products} products, ${counts.images} images.`);
  } catch (error) {
    console.error(`Catalog seed failed: ${error.code ?? error.message}`);
    if (error.code === 'ER_NO_SUCH_TABLE') console.error('Run npm --prefix backend run db:migrate first.');
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
