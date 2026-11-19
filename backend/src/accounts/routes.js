import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { credentials, deliveryAddress } from './validation.js';
import { hashPassword, verifyPassword } from './security.js';
import { HttpError } from '../errors.js';

export function createAccountRoutes({ store, security, attemptLimit = 20 }) {
  const router = Router();
  const limiter = () => rateLimit({ windowMs: 15 * 60 * 1000, limit: attemptLimit,
    standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } });
  let dummyHash;
  router.get('/auth/csrf', security.csrfToken);
  router.post('/auth/register', limiter(), security.protectCsrf, async (req, res) => {
    const { password, ...profile } = credentials(req.body, true);
    const passwordHash = await hashPassword(password);
    try {
      res.status(201).json({ user: await store.createUser({ ...profile, passwordHash }) });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Email is already registered.');
      throw error;
    }
  });
  router.post('/auth/login', limiter(), security.protectCsrf, async (req, res) => {
    const input = credentials(req.body);
    const stored = await store.findUserByEmail(input.email);
    const passwordHash = stored?.passwordHash ?? await (dummyHash ??= hashPassword('Unused password for unknown-account timing protection.'));
    const valid = await verifyPassword(passwordHash, input.password);
    if (!stored || !valid) throw new HttpError(401, 'Invalid email or password.');
    const { passwordHash: privateHash, ...user } = stored;
    res.json({ user, csrfToken: await security.login(req, res, user) });
  });
  router.get('/users/me', security.requireLogin, (req, res) => res.json({ user: req.account.user }));
  router.post('/auth/logout', security.requireLogin, security.protectCsrf, security.logout);
  router.get('/addresses', security.requireLogin, async (req, res) => {
    res.json({ addresses: await store.listAddresses(req.account.user.id) });
  });
  router.post('/addresses', security.requireLogin, security.protectCsrf, async (req, res) => {
    res.status(201).json({ address: await store.createAddress(req.account.user.id, deliveryAddress(req.body)) });
  });
  return router;
}
