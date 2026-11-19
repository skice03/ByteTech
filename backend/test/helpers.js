import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { HttpError } from '../src/errors.js';

export const testPassword = 'A correct test passphrase 2026!';
export const address = { recipientName: 'Test Customer', phone: '+40 712 345 678',
  addressLine: 'Example Street 10, apartment 2', city: 'Bucharest', region: 'Bucharest', postalCode: '010101' };

// Real Express middleware and Node HTTP streams, without opening a network port.
export function client(app, origin = 'http://localhost:5173') {
  const cookies = new Map();
  return {
    cookies, csrfToken: undefined,
    async request(method, path, body, options = {}) {
      const chunks = [];
      const socket = new Duplex({ read() {}, write(chunk, encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
      Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
      const req = new IncomingMessage(socket);
      req.method = method;
      req.url = `/api/v1${path}`;
      req.httpVersion = '1.1';
      req.complete = true;
      req.headers = { host: 'localhost:3000', origin,
        ...Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])) };
      if (cookies.size) req.headers.cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
      const encoded = options.rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
      if (encoded !== undefined) {
        req.headers['content-type'] ??= 'application/json';
        req.headers['content-length'] = String(Buffer.byteLength(encoded));
        req.push(encoded);
      }
      req.push(null);
      const res = new ServerResponse(req);
      res.assignSocket(socket);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Request timed out: ${method} ${path}`)), 5000);
        res.on('finish', () => { clearTimeout(timeout); resolve(); });
        res.on('error', error => { clearTimeout(timeout); reject(error); });
        app(req, res);
      });
      const headers = res.getHeaders(), setCookies = headers['set-cookie'];
      for (const cookie of typeof setCookies === 'string' ? [setCookies] : setCookies ?? []) {
        const first = cookie.split(';')[0], split = first.indexOf('=');
        const name = first.slice(0, split), value = first.slice(split + 1);
        if (value) cookies.set(name, value); else cookies.delete(name);
      }
      const raw = Buffer.concat(chunks).toString();
      const content = raw.slice(raw.indexOf('\r\n\r\n') + 4);
      socket.destroy();
      return { status: res.statusCode, headers, body: content ? JSON.parse(content) : undefined };
    },
    async csrf() {
      const response = await this.request('GET', '/auth/csrf');
      this.csrfToken = response.body.csrfToken;
      return response;
    },
    async mutate(method, path, body, options = {}) {
      return this.request(method, path, body, { ...options, headers: { 'x-csrf-token': this.csrfToken, ...options.headers } });
    },
    post(path, body, options) { return this.mutate('POST', path, body, options); },
    async register(email, password = testPassword) {
      await this.csrf();
      return this.post('/auth/register', { firstName: 'Test', lastName: 'Customer', email, password });
    },
    async login(email, password = testPassword) {
      await this.csrf();
      const response = await this.post('/auth/login', { email, password });
      if (response.body.csrfToken) this.csrfToken = response.body.csrfToken;
      return response;
    }
  };
}

export function memoryStores() {
  const users = new Map(), sessions = new Map(), locations = [], addressLinks = new Map(), cartItems = new Map();
  const products = new Map([
    [1, { productId: 1, name: 'Test Keyboard', price: '12.99', stockQuantity: 10, productActive: 1, categoryActive: 1, imageUrl: '/keyboard.svg' }],
    [2, { productId: 2, name: 'Test Mouse', price: '12.00', stockQuantity: 6, productActive: 1, categoryActive: 1, imageUrl: null }]
  ]);
  let nextUser = 1, nextAddress = 1;
  const publicUser = user => { const { passwordHash, ...result } = user; return result; };
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const accounts = {
    async createUser(input) {
      if ([...users.values()].some(user => user.email === input.email)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      const user = { id: nextUser++, email: input.email, passwordHash: input.passwordHash,
        firstName: input.firstName, lastName: input.lastName, role: 'customer' };
      users.set(user.id, user);
      return publicUser(user);
    },
    async findUserByEmail(email) { return [...users.values()].find(user => user.email === email) ?? null; },
    async createSession(input) {
      for (const [key, value] of sessions) if (value.userId === input.userId && value.expiresAt <= new Date()) sessions.delete(key);
      sessions.set(input.tokenHash, { ...input });
      if (input.previousTokenHash) sessions.delete(input.previousTokenHash);
    },
    async findSession(tokenHash) {
      const session = sessions.get(tokenHash), user = users.get(session?.userId);
      if (!session || !user || session.expiresAt <= new Date()) return null;
      return { tokenHash, csrfTokenHash: session.csrfTokenHash, user: publicUser(user) };
    },
    async updateCsrf(tokenHash, csrfTokenHash) { sessions.get(tokenHash).csrfTokenHash = csrfTokenHash; },
    async deleteSession(tokenHash) { sessions.delete(tokenHash); },
    async listAddresses(userId) {
      return [...addressLinks.values()].filter(link => link.userId === userId)
        .map(link => ({ ...locations.find(item => item.id === link.addressId), recipientName: link.recipientName, phone: link.phone }));
    },
    async createAddress(userId, input) {
      const fields = ['addressLine', 'city', 'region', 'postalCode'];
      let item = locations.find(existing => fields.every(field => normalize(existing[field]) === normalize(input[field])));
      if (!item) {
        item = { id: nextAddress++, ...Object.fromEntries(fields.map(field => [field, input[field]])) };
        locations.push(item);
      }
      addressLinks.set(`${userId}:${item.id}`, { userId, addressId: item.id, recipientName: input.recipientName, phone: input.phone });
      return { ...item, recipientName: input.recipientName, phone: input.phone };
    }
  };
  const listCart = userId => [...cartItems.values()].filter(item => item.userId === userId)
    .sort((a, b) => a.productId - b.productId).map(item => ({ ...products.get(item.productId), quantity: item.quantity }));
  const cart = {
    async listCart(userId) { return listCart(userId); },
    async changeQuantity(userId, productId, quantity, mode) {
      const product = products.get(productId);
      if (!product) throw new HttpError(404, 'Product not found.');
      if (!product.productActive || !product.categoryActive) throw new HttpError(409, 'Product is not available.');
      const key = `${userId}:${productId}`, current = cartItems.get(key);
      if (mode === 'replace' && !current) throw new HttpError(404, 'Product is not in your cart.');
      const next = mode === 'add' ? (current?.quantity ?? 0) + quantity : quantity;
      if (next > product.stockQuantity) throw new HttpError(409, 'Quantity exceeds available stock.');
      cartItems.set(key, { userId, productId, quantity: next });
      return listCart(userId);
    },
    async removeItem(userId, productId) { cartItems.delete(`${userId}:${productId}`); return listCart(userId); }
  };
  return { accounts, cart, users, sessions, locations, addressLinks, products, cartItems };
}
