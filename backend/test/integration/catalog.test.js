import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { migrate } from '../../scripts/migrate.js';
import { seedCatalog } from '../../scripts/seed-catalog.js';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { createDatabase } from '../../src/database.js';
import { catalog } from '../../seed/catalog.js';
import { client } from '../helpers.js';

// Explicit opt-in: never migrate or seed the development database from tests.
const testDatabase = process.env.TEST_DB_DATABASE;
if (!testDatabase || !/^[a-zA-Z0-9_]+_test$/.test(testDatabase)) {
  throw new Error('Set TEST_DB_DATABASE to a dedicated database ending in _test. See backend/api.md#verification.');
}
const config = readConfig({ ...process.env, DB_DATABASE: testDatabase });
const names = catalog.flatMap(category => category.products.map(item => item.name));

test('A1 seed and catalog reads with MySQL', async t => {
  await migrate(config.database);
  const db = createDatabase(config.database);
  const browser = client(createApp({ db }));
  try {
    await t.test('the seed is repeatable: a second run updates rows instead of duplicating them', async () => {
      const first = await seedCatalog(db);
      const [before] = await db.query('SELECT id, name FROM products WHERE name IN (?) ORDER BY id', [names]);
      const second = await seedCatalog(db);
      const [after] = await db.query('SELECT id, name FROM products WHERE name IN (?) ORDER BY id', [names]);
      assert.deepEqual(second, first);
      assert.deepEqual(after, before);
      assert.equal(after.length, names.length);
      const [[images]] = await db.query(`SELECT COUNT(*) AS count FROM product_images image
        JOIN products p ON p.id = image.product_id WHERE p.name IN (?)`, [names]);
      assert.equal(Number(images.count), first.images);
    });

    await t.test('catalog routes read seeded products, categories and images from MySQL', async () => {
      const categories = (await browser.request('GET', '/categories')).body.categories;
      for (const category of catalog) {
        const found = categories.find(item => item.name === category.name);
        assert.ok(found && found.productCount >= category.products.length, category.name);
      }
      const list = await browser.request('GET', '/products');
      assert.equal(list.status, 200);
      assert.ok(list.body.products.length <= 24);
      assert.ok(list.body.pagination.totalItems >= names.length);

      const laptops = categories.find(item => item.name === catalog[0].name);
      const inCategory = await browser.request('GET', `/products?categoryId=${laptops.id}`);
      assert.ok(inCategory.body.products.every(item => item.category.id === laptops.id));

      const expected = catalog[0].products[0];
      const [[row]] = await db.execute('SELECT id FROM products WHERE name = ?', [expected.name]);
      const detail = (await browser.request('GET', `/products/${row.id}`)).body.product;
      assert.equal(detail.name, expected.name);
      assert.equal(detail.description, expected.description);
      assert.equal(detail.price, expected.price);
      assert.equal(detail.stockQuantity, expected.stockQuantity);
      assert.deepEqual(detail.images, expected.images);
    });
    await t.test('MySQL searches product names case-insensitively and treats wildcard characters literally', async () => {
      const result = await browser.request('GET', '/products/search?q=UlTrAbOoK');
      assert.equal(result.status, 200);
      assert.ok(result.body.products.some(product => product.name === catalog[0].products[0].name));
      assert.ok(result.body.products.every(product => product.name.toLowerCase().includes('ultrabook')));
      const literal = await browser.request('GET', '/products/search?q=%25_');
      assert.equal(literal.status, 200);
      assert.ok(literal.body.products.every(product => product.name.includes('%_')));
    });
    await t.test('a shopper can find a seeded product, sign in and keep that product in their cart', async () => {
      const email = `catalog-${randomUUID()}@example.test`;
      const expected = catalog[0].products[0];
      const result = await browser.request('GET', '/products/search?q=' + encodeURIComponent(expected.name));
      const product = result.body.products.find(item => item.name === expected.name);
      assert.ok(product);
      try {
        assert.equal((await browser.register(email)).status, 201);
        assert.equal((await browser.login(email)).status, 200);
        const added = await browser.post('/cart/items', { productId: product.id, quantity: 1 });
        assert.equal(added.status, 201);
        assert.equal(added.body.cart.total, expected.price);
        assert.equal((await browser.post('/auth/logout', {})).status, 204);
        assert.equal((await browser.request('GET', '/cart')).status, 401);
        assert.equal((await browser.login(email)).status, 200);
        const cart = (await browser.request('GET', '/cart')).body.cart;
        assert.equal(cart.items[0].productId, product.id);
        assert.equal(cart.total, expected.price);
      } finally {
        await db.execute('DELETE FROM users WHERE email = ?', [email]);
      }
    });
  } finally {
    await db.end();
  }
});
