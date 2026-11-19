import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { HttpError } from '../errors.js';

const passwordOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
export const hashPassword = password => argon2.hash(password, passwordOptions);
export const verifyPassword = (hash, password) => argon2.verify(hash, password);
export const hashToken = token => createHash('sha256').update(token).digest('hex');
const opaqueToken = () => randomBytes(32).toString('hex');
const isOpaqueToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

function equal(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionSecurity({ store, origin, secureCookies = false, sessionTtlHours = 24 }) {
  const names = {
    session: secureCookies ? '__Host-bytetech_session' : 'bytetech_session',
    csrf: secureCookies ? '__Host-bytetech_csrf' : 'bytetech_csrf'
  };
  const cookieOptions = { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: '/' };
  const sessionDuration = sessionTtlHours * 60 * 60 * 1000;
  const challengeDuration = 30 * 60 * 1000;
  // Only anonymous CSRF challenges use this process-local signing key.
  // Authenticated session and CSRF hashes persist in MySQL across API restarts.
  const challengeKey = randomBytes(32);
  const sign = (nonce, expires) => createHmac('sha256', challengeKey).update(`anonymous:${nonce}:${expires}`).digest('hex');
  function clearCookies(res) {
    for (const name of Object.values(names)) res.clearCookie(name, cookieOptions);
  }
  function validChallenge(token) {
    if (typeof token !== 'string') return false;
    const match = /^([a-f0-9]{64})\.(\d{13})\.([a-f0-9]{64})$/.exec(token);
    return Boolean(match && Number(match[2]) > Date.now() && equal(match[3], sign(match[1], match[2])));
  }
  return {
    trustedOrigin(req, res, next) {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
      let source = req.get('Origin');
      if (!source && req.get('Referer')) {
        try { source = new URL(req.get('Referer')).origin; } catch { /* Reject below. */ }
      }
      if (source !== origin) throw new HttpError(403, 'Request origin is not allowed.');
      if (req.method !== 'DELETE' && !req.is('application/json')) throw new HttpError(415, 'Use Content-Type: application/json.');
      next();
    },
    async attachSession(req, res, next) {
      req.account = null;
      const token = req.cookies[names.session];
      if (isOpaqueToken(token)) req.account = await store.findSession(hashToken(token));
      next();
    },
    requireLogin(req, res, next) {
      if (!req.account) {
        if (req.cookies[names.session]) clearCookies(res);
        throw new HttpError(401, 'Login required.');
      }
      next();
    },
    protectCsrf(req, res, next) {
      const token = req.get('X-CSRF-Token'), cookie = req.cookies[names.csrf];
      const valid = equal(token, cookie) && (req.account
        ? isOpaqueToken(token) && equal(hashToken(token), req.account.csrfTokenHash)
        : validChallenge(token));
      if (!valid) throw new HttpError(403, 'Invalid CSRF token. Request a token from /api/v1/auth/csrf.');
      next();
    },
    async csrfToken(req, res) {
      let token = req.cookies[names.csrf];
      if (req.account) {
        if (!isOpaqueToken(token) || !equal(hashToken(token), req.account.csrfTokenHash)) {
          token = opaqueToken();
          await store.updateCsrf(req.account.tokenHash, hashToken(token));
          res.cookie(names.csrf, token, { ...cookieOptions, maxAge: sessionDuration });
        }
      } else {
        if (req.cookies[names.session]) clearCookies(res);
        if (!validChallenge(token)) {
          const nonce = opaqueToken(), expires = String(Date.now() + challengeDuration);
          token = `${nonce}.${expires}.${sign(nonce, expires)}`;
        }
        res.cookie(names.csrf, token, { ...cookieOptions, maxAge: challengeDuration });
      }
      res.json({ csrfToken: token });
    },
    async login(req, res, user) {
      const token = opaqueToken(), csrfToken = opaqueToken();
      await store.createSession({ userId: user.id, tokenHash: hashToken(token), csrfTokenHash: hashToken(csrfToken),
        expiresAt: new Date(Date.now() + sessionDuration), previousTokenHash: req.account?.tokenHash });
      res.cookie(names.session, token, { ...cookieOptions, maxAge: sessionDuration });
      res.cookie(names.csrf, csrfToken, { ...cookieOptions, maxAge: sessionDuration });
      return csrfToken;
    },
    async logout(req, res) {
      await store.deleteSession(req.account.tokenHash);
      clearCookies(res);
      res.status(204).end();
    }
  };
}
