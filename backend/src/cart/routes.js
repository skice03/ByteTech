import { Router } from 'express';
import { addItem, replaceQuantity } from './validation.js';
import { pathId } from '../validation.js';
import { formatCart } from './totals.js';

export function createCartRoutes({ store, security }) {
  const router = Router();
  router.use(security.requireLogin);
  router.get('/', async (req, res) => res.json({ cart: formatCart(await store.listCart(req.account.user.id)) }));
  router.post('/items', security.protectCsrf, async (req, res) => {
    const { productId, quantity } = addItem(req.body);
    res.status(201).json({ cart: formatCart(await store.changeQuantity(req.account.user.id, productId, quantity, 'add')) });
  });
  router.patch('/items/:productId', security.protectCsrf, async (req, res) => {
    const productId = pathId(req.params.productId), quantity = replaceQuantity(req.body);
    res.json({ cart: formatCart(await store.changeQuantity(req.account.user.id, productId, quantity, 'replace')) });
  });
  router.delete('/items/:productId', security.protectCsrf, async (req, res) => {
    res.json({ cart: formatCart(await store.removeItem(req.account.user.id, pathId(req.params.productId))) });
  });
  return router;
}
