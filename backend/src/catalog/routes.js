import { Router } from 'express';
import Decimal from 'decimal.js';
import { HttpError } from '../errors.js';
import { pathId } from '../validation.js';

export const pageSize = 24;
const maxPage = 10000;

function listQuery(query) {
  const allowed = ['page', 'categoryId'];
  if (Object.keys(query).some(key => !allowed.includes(key))) throw new HttpError(400, 'Unsupported query parameter.');
  let page = 1;
  if (query.page !== undefined) {
    if (typeof query.page !== 'string' || !/^[1-9]\d{0,4}$/.test(query.page) || Number(query.page) > maxPage) {
      throw new HttpError(400, `page must be an integer between 1 and ${maxPage}.`);
    }
    page = Number(query.page);
  }
  const categoryId = query.categoryId === undefined ? undefined : pathId(query.categoryId, 'category');
  return { page, categoryId };
}

const money = value => new Decimal(value).toFixed(2);
const category = row => ({ id: row.categoryId, name: row.categoryName });

function summary(row) {
  return {
    id: row.id, name: row.name, price: money(row.price), currency: 'RON',
    stockQuantity: row.stockQuantity, isAvailable: row.stockQuantity > 0, category: category(row),
    image: row.imageUrl ? { url: row.imageUrl, altText: row.imageAlt } : null
  };
}

export function createCatalogRoutes({ store }) {
  const router = Router();
  router.get('/categories', async (req, res) => {
    res.json({ categories: await store.listCategories() });
  });
  router.get('/categories/:categoryId', async (req, res) => {
    const found = await store.findCategory(pathId(req.params.categoryId, 'category'));
    if (!found) throw new HttpError(404, 'Category not found.');
    res.json({ category: found });
  });
  router.get('/products', async (req, res) => {
    const { page, categoryId } = listQuery(req.query);
    if (categoryId && !await store.findCategory(categoryId)) throw new HttpError(404, 'Category not found.');
    const { rows, total } = await store.listProducts({ categoryId, limit: pageSize, offset: (page - 1) * pageSize });
    res.json({
      products: rows.map(summary),
      pagination: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) }
    });
  });
  router.get('/products/:productId', async (req, res) => {
    const row = await store.findProduct(pathId(req.params.productId));
    if (!row) throw new HttpError(404, 'Product not found.');
    const { image, ...rest } = summary(row);
    res.json({ product: { ...rest, description: row.description, images: row.images } });
  });
  return router;
}
