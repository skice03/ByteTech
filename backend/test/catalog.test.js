import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { catalog } from '../seed/catalog.js';
import { client, memoryStores } from './helpers.js';

// In-memory catalog with the same visibility and ordering rules as the SQL store.
function memoryCatalog() {
  const categories = [
    { id: 1, name: 'Laptops', isActive: true },
    { id: 2, name: 'Monitors', isActive: true },
    { id: 3, name: 'Archived', isActive: false }
  ];
  const products = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1, categoryId: i < 26 ? 1 : 2, name: `Product ${i + 1}`, description: `Description ${i + 1}`,
    price: i === 0 ? '4299' : '19.90', stockQuantity: i === 1 ? 0 : 5, isActive: i !== 2,
    images: i === 0 ? [{ url: '/b.svg', altText: 'Second', sortOrder: 1 }, { url: '/a.svg', altText: 'First', sortOrder: 0 }] : []
  }));
  products.push({ id: 31, categoryId: 3, name: 'Hidden by category', description: '', price: '1.00', stockQuantity: 1, isActive: true, images: [] });
  const visible = () => products.filter(p => p.isActive && categories.find(c => c.id === p.categoryId).isActive);
  const sorted = images => [...images].sort((a, b) => a.sortOrder - b.sortOrder).map(({ url, altText }) => ({ url, altText }));
  const row = p => {
    const c = categories.find(item => item.id === p.categoryId), first = sorted(p.images)[0];
    return { id: p.id, name: p.name, description: p.description, price: p.price, stockQuantity: p.stockQuantity,
      categoryId: c.id, categoryName: c.name, imageUrl: first?.url ?? null, imageAlt: first?.altText ?? null, images: sorted(p.images) };
  };
  return {
    categories, products,
    async listCategories() {
      return categories.filter(c => c.isActive).sort((a, b) => a.name.localeCompare(b.name))
        .map(c => ({ id: c.id, name: c.name, productCount: products.filter(p => p.isActive && p.categoryId === c.id).length }));
    },
    async findCategory(id) {
      const c = categories.find(item => item.id === id && item.isActive);
      return c ? { id: c.id, name: c.name } : null;
    },
    async listProducts({ categoryId, searchTerm = '', limit, offset }) {
      const matches = visible().filter(p => (!categoryId || p.categoryId === categoryId)
        && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
      return { rows: matches.slice(offset, offset + limit).map(row), total: matches.length };
    },
    async findProduct(id) {
      const p = visible().find(item => item.id === id);
      return p ? row(p) : null;
    }
  };
}

function setup() {
  const catalogStore = memoryCatalog();
  return { catalogStore, browser: client(createApp({ db: {}, stores: { ...memoryStores(), catalog: catalogStore } })) };
}

test('catalog reads are public and list only active categories with active product counts', async () => {
  const { browser } = setup();
  const response = await browser.request('GET', '/categories');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.categories, [{ id: 1, name: 'Laptops', productCount: 25 }, { id: 2, name: 'Monitors', productCount: 4 }]);
  assert.deepEqual((await browser.request('GET', '/categories/2')).body.category, { id: 2, name: 'Monitors' });
  assert.equal((await browser.request('GET', '/categories/3')).status, 404);
  assert.equal((await browser.request('GET', '/categories/99')).status, 404);
});

test('product lists return at most 24 items per page with pagination details', async () => {
  const { browser } = setup();
  const first = await browser.request('GET', '/products');
  assert.equal(first.status, 200);
  assert.equal(first.body.products.length, 24);
  assert.deepEqual(first.body.pagination, { page: 1, pageSize: 24, totalItems: 29, totalPages: 2 });
  const second = await browser.request('GET', '/products?page=2');
  assert.equal(second.body.products.length, 5);
  assert.ok(!second.body.products.some(p => p.id === 3 || p.id === 31), 'inactive products must be hidden');
  const beyond = await browser.request('GET', '/products?page=3');
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body.products, []);
});

test('category pages list only that category and reject unknown or inactive categories', async () => {
  const { browser } = setup();
  const monitors = await browser.request('GET', '/products?categoryId=2');
  assert.deepEqual(monitors.body.products.map(p => p.id), [27, 28, 29, 30]);
  assert.ok(monitors.body.products.every(p => p.category.name === 'Monitors'));
  assert.equal(monitors.body.pagination.totalPages, 1);
  assert.equal((await browser.request('GET', '/products?categoryId=3')).status, 404);
  assert.equal((await browser.request('GET', '/products?categoryId=99')).status, 404);
});

test('name search trims text, filters before pagination and omits inactive or unmatched products', async () => {
  const { browser } = setup();
  const result = await browser.request('GET', '/products/search?q=%20PrOdUcT%20&page=2');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.pagination, { page: 2, pageSize: 24, totalItems: 29, totalPages: 2 });
  assert.deepEqual(result.body.products.map(p => p.id), [26, 27, 28, 29, 30]);
  for (const term of ['Description', 'Hidden', '%25', '_']) {
    const none = await browser.request('GET', '/products/search?q=' + term);
    assert.equal(none.status, 200);
    assert.deepEqual(none.body.products, []);
    assert.equal(none.body.pagination.totalItems, 0);
  }
});

test('search requires a single nonblank name of at most 200 characters', async () => {
  const { browser } = setup();
  for (const query of ['', 'q=%20', 'q=a&q=b', 'q=' + 'a'.repeat(201)]) {
    assert.equal((await browser.request('GET', '/products/search?' + query)).status, 400, query);
  }
});

test('list items expose two-decimal RON prices, availability and the first image', async () => {
  const { browser } = setup();
  const [first, second] = (await browser.request('GET', '/products')).body.products;
  assert.deepEqual(first, { id: 1, name: 'Product 1', price: '4299.00', currency: 'RON', stockQuantity: 5,
    isAvailable: true, category: { id: 1, name: 'Laptops' }, image: { url: '/a.svg', altText: 'First' } });
  assert.equal(second.isAvailable, false);
  assert.equal(second.image, null);
});

test('product detail shows name, description, price, ordered images and availability', async () => {
  const { browser } = setup();
  const response = await browser.request('GET', '/products/1');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.product, { id: 1, name: 'Product 1', price: '4299.00', currency: 'RON', stockQuantity: 5,
    isAvailable: true, category: { id: 1, name: 'Laptops' }, description: 'Description 1',
    images: [{ url: '/a.svg', altText: 'First' }, { url: '/b.svg', altText: 'Second' }] });
  assert.equal((await browser.request('GET', '/products/2')).body.product.isAvailable, false);
  for (const id of [3, 31, 999]) assert.equal((await browser.request('GET', `/products/${id}`)).status, 404);
});

test('invalid pages, IDs and query parameters are rejected', async () => {
  const { browser } = setup();
  for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=10001', 'page=1&page=2',
    'categoryId=0', 'categoryId=abc', 'categoryId=1&categoryId=2', 'sort=price', 'q=laptop']) {
    assert.equal((await browser.request('GET', `/products?${query}`)).status, 400, query);
  }
  for (const id of ['0', '-1', '1.5', 'abc', '4294967296']) {
    assert.equal((await browser.request('GET', `/products/${id}`)).status, 400, id);
    assert.equal((await browser.request('GET', `/categories/${id}`)).status, 400, id);
  }
});

test('the A1 seed has at least 30 valid products in at least four categories, each with an image', async () => {
  assert.ok(catalog.length >= 4);
  const products = catalog.flatMap(category => category.products);
  assert.ok(products.length >= 30);
  assert.equal(new Set(catalog.map(category => category.name)).size, catalog.length, 'category names must be unique');
  assert.equal(new Set(products.map(item => item.name)).size, products.length, 'product names must be unique');
  for (const category of catalog) assert.ok(category.products.length > 0 && category.name.length <= 100);
  for (const item of products) {
    assert.ok(item.name.length <= 200 && item.description.length > 40, item.name);
    assert.match(item.price, /^\d{1,8}\.\d{2}$/, item.name);
    assert.ok(Number.isInteger(item.stockQuantity) && item.stockQuantity >= 0, item.name);
    assert.ok(item.images.length >= 1, item.name);
    for (const image of item.images) {
      assert.ok(image.altText.length > 0 && image.altText.length <= 255 && image.url.length <= 500, item.name);
      await access(new URL(`../../frontend/public${image.url}`, import.meta.url));
    }
  }
});
