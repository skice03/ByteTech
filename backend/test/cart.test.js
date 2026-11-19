import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { formatCart } from '../src/cart/totals.js';
import { client, memoryStores } from './helpers.js';

async function setup() {
  const memory = memoryStores();
  const app = createApp({ db: {}, stores: memory });
  const browser = client(app);
  await browser.register('cart@example.test');
  await browser.login('cart@example.test');
  return { memory, app, browser };
}

test('all cart operations require authentication', async () => {
  const browser = client(createApp({ db: {}, stores: memoryStores() }));
  for (const [method, path, body] of [
    ['GET', '/cart'], ['POST', '/cart/items', { productId: 1, quantity: 1 }],
    ['PATCH', '/cart/items/1', { quantity: 2 }], ['DELETE', '/cart/items/1']
  ]) assert.equal((await browser.request(method, path, body)).status, 401);
});

test('empty carts have zero totals in RON', async () => {
  const { browser } = await setup();
  assert.deepEqual((await browser.request('GET', '/cart')).body.cart,
    { items: [], itemCount: 0, total: '0.00', currency: 'RON' });
});

test('adding increments quantity and computes all prices on the server', async () => {
  const { browser } = await setup();
  assert.equal((await browser.post('/cart/items', { productId: 1, quantity: 2 })).status, 201);
  await browser.post('/cart/items', { productId: 1, quantity: 1 });
  const response = await browser.post('/cart/items', { productId: 2, quantity: 2 });
  assert.equal(response.status, 201);
  assert.equal(response.body.cart.items.length, 2);
  assert.equal(response.body.cart.itemCount, 5);
  assert.equal(response.body.cart.total, '62.97');
  assert.equal(response.body.cart.items[0].lineTotal, '38.97');
  assert.equal(response.body.cart.items[1].unitPrice, '12.00');
  assert.equal(response.body.cart.items[0].imageUrl, '/keyboard.svg');
});

test('PATCH replaces quantity; DELETE removes a line and is idempotent', async () => {
  const { browser } = await setup();
  await browser.post('/cart/items', { productId: 1, quantity: 4 });
  const replaced = await browser.mutate('PATCH', '/cart/items/1', { quantity: 2 });
  assert.equal(replaced.status, 200);
  assert.equal(replaced.body.cart.itemCount, 2);
  assert.equal(replaced.body.cart.total, '25.98');
  assert.equal((await browser.mutate('DELETE', '/cart/items/1')).body.cart.total, '0.00');
  assert.equal((await browser.mutate('DELETE', '/cart/items/1')).status, 200);
});

test('money calculations retain two decimal places without floating-point errors', () => {
  const rows = [
    { productId: 1, name: 'A', price: '0.10', quantity: 1 },
    { productId: 2, name: 'B', price: '0.20', quantity: 1 }
  ].map(row => ({ ...row, imageUrl: null, productActive: 1, categoryActive: 1, stockQuantity: 20 }));
  assert.equal(formatCart(rows).total, '0.30');
  assert.equal(formatCart([{ ...rows[0], price: '99999999.99', quantity: 4294967295 }]).total, '429496729457050327.05');
});

test('invalid quantities and IDs are rejected without changing the cart', async () => {
  const { browser } = await setup();
  for (const quantity of [0, -1, 1.5, '2', null, 4294967296]) {
    assert.equal((await browser.post('/cart/items', { productId: 1, quantity })).status, 400);
    assert.equal((await browser.mutate('PATCH', '/cart/items/1', { quantity })).status, 400);
  }
  for (const productId of [0, -1, 1.5, '1', null, 4294967296]) {
    assert.equal((await browser.post('/cart/items', { productId, quantity: 1 })).status, 400);
  }
  for (const id of ['0', '-1', '1.5', 'abc', '4294967296']) {
    assert.equal((await browser.mutate('DELETE', `/cart/items/${id}`)).status, 400);
  }
  assert.equal((await browser.request('GET', '/cart')).body.cart.itemCount, 0);
});

test('client prices, totals and user IDs cannot override cart ownership or prices', async () => {
  const { browser } = await setup();
  for (const extra of [{ price: '0.01' }, { total: '0.01' }, { userId: 2 }]) {
    assert.equal((await browser.post('/cart/items', { productId: 1, quantity: 1, ...extra })).status, 400);
  }
  assert.equal((await browser.request('GET', '/cart')).body.cart.itemCount, 0);
});

test('stock checks use the resulting quantity and failures preserve the previous cart', async () => {
  const { browser, memory } = await setup();
  await browser.post('/cart/items', { productId: 1, quantity: 9 });
  assert.equal((await browser.post('/cart/items', { productId: 1, quantity: 2 })).status, 409);
  assert.equal((await browser.mutate('PATCH', '/cart/items/1', { quantity: 11 })).status, 409);
  assert.equal((await browser.request('GET', '/cart')).body.cart.itemCount, 9);
  assert.equal(memory.products.get(1).stockQuantity, 10);
  memory.products.get(2).stockQuantity = 0;
  assert.equal((await browser.post('/cart/items', { productId: 2, quantity: 1 })).status, 409);
});

test('inactive products/categories and missing products cannot be added', async () => {
  const { browser, memory } = await setup();
  memory.products.get(1).productActive = 0;
  memory.products.get(2).categoryActive = 0;
  for (const productId of [1, 2]) assert.equal((await browser.post('/cart/items', { productId, quantity: 1 })).status, 409);
  assert.equal((await browser.post('/cart/items', { productId: 999, quantity: 1 })).status, 404);
  assert.equal((await browser.mutate('PATCH', '/cart/items/999', { quantity: 1 })).status, 404);
  memory.products.get(1).productActive = 1;
  assert.equal((await browser.mutate('PATCH', '/cart/items/1', { quantity: 1 })).status, 404);
});

test('users can only read and modify their own cart', async () => {
  const { browser, app } = await setup();
  await browser.post('/cart/items', { productId: 1, quantity: 3 });
  const other = client(app);
  await other.register('other@example.test');
  await other.login('other@example.test');
  assert.equal((await other.request('GET', '/cart')).body.cart.itemCount, 0);
  assert.equal((await other.mutate('PATCH', '/cart/items/1', { quantity: 1 })).status, 404);
  await other.mutate('DELETE', '/cart/items/1');
  await other.post('/cart/items', { productId: 1, quantity: 2 });
  assert.equal((await browser.request('GET', '/cart')).body.cart.itemCount, 3);
  assert.equal((await other.request('GET', '/cart')).body.cart.itemCount, 2);
});

test('GET recalculates current prices and flags lines that became unavailable', async () => {
  const { browser, memory } = await setup();
  await browser.post('/cart/items', { productId: 1, quantity: 3 });
  memory.products.get(1).price = '10.10';
  memory.products.get(1).stockQuantity = 2;
  const response = await browser.request('GET', '/cart');
  assert.equal(response.body.cart.total, '30.30');
  assert.equal(response.body.cart.items[0].isAvailable, false);
  assert.equal(response.body.cart.items[0].quantity, 3);
  memory.products.get(1).stockQuantity = 10;
  memory.products.get(1).categoryActive = 0;
  assert.equal((await browser.request('GET', '/cart')).body.cart.items[0].isAvailable, false);
  assert.equal((await browser.mutate('DELETE', '/cart/items/1')).status, 200);
});

test('cart mutations require a valid session CSRF token', async () => {
  const { browser } = await setup();
  await browser.post('/cart/items', { productId: 1, quantity: 1 });
  for (const [method, path, body] of [
    ['POST', '/cart/items', { productId: 1, quantity: 1 }],
    ['PATCH', '/cart/items/1', { quantity: 2 }], ['DELETE', '/cart/items/1']
  ]) assert.equal((await browser.request(method, path, body)).status, 403);
  assert.equal((await browser.request('GET', '/cart')).body.cart.itemCount, 1);
});
