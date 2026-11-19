import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { migrate } from '../../scripts/migrate.js';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { createDatabase } from '../../src/database.js';
import { hashToken } from '../../src/accounts/security.js';
import { address, client } from '../helpers.js';

// Explicit opt-in: never migrate or write fixtures to the development database.
const testDatabase = process.env.TEST_DB_DATABASE;
if (!testDatabase || !/^[a-zA-Z0-9_]+_test$/.test(testDatabase)) {
  throw new Error('Set TEST_DB_DATABASE to a dedicated database ending in _test. See backend/api.md#verification.');
}
const config = readConfig({ ...process.env, DB_DATABASE: testDatabase });

test('A4/A3 with MySQL migrations, persistence, constraints and concurrent requests', async t => {
  await migrate(config.database);
  const db = createDatabase(config.database);
  const app = createApp({ db, attemptLimit: 100 });
  const run = randomUUID(), emails = [`first-${run}@example.test`, `second-${run}@example.test`];
  const first = client(app), second = client(app);
  const location = { ...address, addressLine: `Integration ${run}, apartment 2` };
  let categoryId, productId, otherProductId, addressId;
  try {
    await t.test('migration reruns preserve the ledger and provide the account and cart tables', async () => {
      const ledgerQuery = 'SELECT name, checksum, applied_at FROM _schema_migrations ORDER BY name';
      const [before] = await db.query(ledgerQuery);
      assert.ok(before.some(row => row.name === '001_accounts_and_cart.sql'));
      await migrate(config.database);
      const [after] = await db.query(ledgerQuery);
      assert.deepEqual(after, before);
      const [tables] = await db.execute('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [testDatabase]);
      const names = new Set(tables.map(row => row.name));
      for (const table of ['users', 'user_sessions', 'user_addresses', 'user_address_links',
        'categories', 'products', 'product_images', 'cart_items']) {
        assert.ok(names.has(table), `Missing table: ${table}`);
      }
      assert.equal((await first.request('GET', '/ready')).status, 200);
    });

    await t.test('registration and login persist hashes and enforce account uniqueness', async () => {
      assert.equal((await first.register(emails[0])).status, 201);
      assert.equal((await second.register(emails[1])).status, 201);
      assert.equal((await first.register(emails[0].toUpperCase())).status, 409);
      assert.equal((await first.login(emails[0])).status, 200);
      assert.equal((await second.login(emails[1])).status, 200);
      const [[user]] = await db.execute('SELECT id, password_hash, role FROM users WHERE email = ?', [emails[0]]);
      assert.match(user.password_hash, /^\$argon2id\$/);
      assert.equal(user.role, 'customer');
      const [[session]] = await db.execute('SELECT token_hash, csrf_token_hash FROM user_sessions WHERE user_id = ?', [user.id]);
      assert.equal(session.token_hash, hashToken(first.cookies.get('bytetech_session')));
      assert.equal(session.csrf_token_hash, hashToken(first.csrfToken));
      assert.equal((await first.request('GET', '/users/me')).body.user.password_hash, undefined);
    });

    await t.test('simultaneous family address saves share one location with separate contacts', async () => {
      const responses = await Promise.all([
        first.post('/addresses', location),
        second.post('/addresses', { ...location, recipientName: 'Family member', phone: '+40 722 345 678' })
      ]);
      assert.deepEqual(responses.map(response => response.status), [201, 201]);
      addressId = responses[0].body.address.id;
      assert.equal(responses[1].body.address.id, addressId);
      const [[links]] = await db.execute('SELECT COUNT(*) AS count FROM user_address_links WHERE address_id = ?', [addressId]);
      assert.equal(links.count, 2);
      await second.post('/addresses', { ...location, recipientName: 'Updated family member' });
      assert.equal((await first.request('GET', '/addresses')).body.addresses[0].recipientName, address.recipientName);
      assert.equal((await second.request('GET', '/addresses')).body.addresses[0].recipientName, 'Updated family member');
    });

    // Test fixtures only; the A1 catalog/seed implementation belongs to Alexandru.
    const [category] = await db.execute('INSERT INTO categories (name) VALUES (?)', [`Integration ${run}`]);
    categoryId = category.insertId;
    const [product] = await db.execute(`INSERT INTO products (category_id, name, description, price, stock_quantity)
      VALUES (?, 'Keyboard', 'Integration fixture', 12.99, 5)`, [categoryId]);
    productId = product.insertId;
    const [otherProduct] = await db.execute(`INSERT INTO products (category_id, name, description, price, stock_quantity)
      VALUES (?, 'Mouse', 'Integration fixture', 12.00, 6)`, [categoryId]);
    otherProductId = otherProduct.insertId;
    await db.execute("INSERT INTO product_images (product_id, url, alt_text) VALUES (?, '/test/keyboard.svg', 'Keyboard')", [productId]);

    await t.test('cart uses SQL catalog prices, persists across logout and survives API recreation', async () => {
      assert.equal((await first.post('/cart/items', { productId, quantity: 2 })).status, 201);
      const added = await first.post('/cart/items', { productId: otherProductId, quantity: 2 });
      assert.equal(added.body.cart.total, '49.98');
      assert.equal(added.body.cart.items.find(item => item.productId === productId).imageUrl, '/test/keyboard.svg');
      assert.equal((await second.request('GET', '/cart')).body.cart.itemCount, 0);
      await second.mutate('DELETE', `/cart/items/${productId}`);
      assert.equal((await first.request('GET', '/cart')).body.cart.itemCount, 4);
      const previousSession = hashToken(first.cookies.get('bytetech_session'));
      assert.equal((await first.post('/auth/logout', {})).status, 204);
      const [revoked] = await db.execute('SELECT token_hash FROM user_sessions WHERE token_hash = ?', [previousSession]);
      assert.equal(revoked.length, 0);
      await first.login(emails[0]);
      const resumed = client(createApp({ db }));
      for (const [key, value] of first.cookies) resumed.cookies.set(key, value);
      resumed.csrfToken = first.csrfToken;
      assert.equal((await resumed.request('GET', '/cart')).body.cart.total, '49.98');
      assert.equal((await resumed.request('GET', '/addresses')).body.addresses[0].id, addressId);
      assert.equal((await resumed.mutate('PATCH', `/cart/items/${productId}`, { quantity: 3 })).body.cart.total, '62.97');
      assert.equal((await resumed.mutate('DELETE', `/cart/items/${otherProductId}`)).body.cart.total, '38.97');
      await db.execute('UPDATE products SET price = 10.10, stock_quantity = 2 WHERE id = ?', [productId]);
      const changed = (await resumed.request('GET', '/cart')).body.cart;
      assert.equal(changed.total, '30.30');
      assert.equal(changed.items[0].isAvailable, false);
      await db.execute('UPDATE products SET price = 12.99, stock_quantity = 5 WHERE id = ?', [productId]);
    });

    await t.test('stock and availability failures roll back without changing the existing quantity', async () => {
      assert.equal((await first.post('/cart/items', { productId, quantity: 3 })).status, 409);
      assert.equal((await first.mutate('PATCH', `/cart/items/${productId}`, { quantity: 6 })).status, 409);
      assert.equal((await first.request('GET', '/cart')).body.cart.itemCount, 3);
      await db.execute('UPDATE categories SET is_active = FALSE WHERE id = ?', [categoryId]);
      assert.equal((await first.post('/cart/items', { productId, quantity: 1 })).status, 409);
      await db.execute('UPDATE categories SET is_active = TRUE WHERE id = ?', [categoryId]);
      assert.equal((await second.mutate('PATCH', `/cart/items/${productId}`, { quantity: 1 })).status, 404);
      assert.equal((await first.post('/cart/items', { productId: 4294967295, quantity: 1 })).status, 404);
    });

    await t.test('concurrent additions cannot exceed stock or lose increments; carts do not reserve stock', async () => {
      await first.mutate('DELETE', `/cart/items/${productId}`);
      const results = await Promise.all(Array.from({ length: 10 }, () => first.post('/cart/items', { productId, quantity: 1 })));
      assert.equal(results.filter(response => response.status === 201).length, 5);
      assert.equal(results.filter(response => response.status === 409).length, 5);
      assert.equal((await first.request('GET', '/cart')).body.cart.itemCount, 5);
      assert.equal((await second.post('/cart/items', { productId, quantity: 5 })).status, 201);
      const [[stock]] = await db.execute('SELECT stock_quantity FROM products WHERE id = ?', [productId]);
      assert.equal(stock.stock_quantity, 5);
    });

    await t.test('foreign keys, composite uniqueness and positive quantity checks protect persisted data', async () => {
      const [[user]] = await db.execute('SELECT id FROM users WHERE email = ?', [emails[0]]);
      await assert.rejects(db.execute('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, 1)',
        [user.id, productId]), { code: 'ER_DUP_ENTRY' });
      await assert.rejects(db.execute('UPDATE cart_items SET quantity = 0 WHERE user_id = ? AND product_id = ?',
        [user.id, productId]), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
      await assert.rejects(db.execute('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, 4294967295, 1)',
        [user.id]), { code: 'ER_NO_REFERENCED_ROW_2' });
      await assert.rejects(db.execute('UPDATE products SET price = -1 WHERE id = ?', [productId]), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    });

    await t.test('expired sessions are rejected and deleting one user preserves the family location and other account', async () => {
      await db.execute("UPDATE user_sessions SET expires_at = '2000-01-01' WHERE token_hash = ?", [hashToken(first.cookies.get('bytetech_session'))]);
      assert.equal((await first.request('GET', '/users/me')).status, 401);
      await db.execute('DELETE FROM users WHERE email = ?', [emails[0]]);
      const [[links]] = await db.execute('SELECT COUNT(*) AS count FROM user_address_links WHERE address_id = ?', [addressId]);
      assert.equal(links.count, 1);
      assert.equal((await second.request('GET', '/addresses')).body.addresses[0].id, addressId);
      assert.equal((await second.request('GET', '/cart')).body.cart.itemCount, 5);
    });
  } finally {
    // Only this run's fixtures are removed. No truncation or database reset.
    try {
      await db.execute('DELETE FROM users WHERE email IN (?, ?)', emails);
      if (categoryId) {
        await db.execute('DELETE FROM products WHERE category_id = ?', [categoryId]);
        await db.execute('DELETE FROM categories WHERE id = ?', [categoryId]);
      }
      await db.execute('DELETE FROM user_addresses WHERE address_line = ? AND NOT EXISTS (SELECT 1 FROM user_address_links WHERE address_id = user_addresses.id)', [location.addressLine]);
    } finally { await db.end(); }
  }
});
