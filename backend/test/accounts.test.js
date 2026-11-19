import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { hashToken, verifyPassword } from '../src/accounts/security.js';
import { client, memoryStores, address, testPassword } from './helpers.js';

function setup(options = {}) {
  const memory = memoryStores();
  const app = createApp({ db: { query: async () => { throw new Error('offline'); } },
    stores: memory, attemptLimit: 100, logger: { error() {} }, ...options });
  return { memory, app, browser: client(app) };
}

test('registration normalizes email, hashes passwords and creates only customer accounts', async () => {
  const { browser, memory } = setup();
  const response = await browser.register(' CUSTOMER@Example.test ');
  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, 'customer@example.test');
  assert.equal(response.body.user.role, 'customer');
  assert.equal(response.body.user.passwordHash, undefined);
  const user = [...memory.users.values()][0];
  assert.match(user.passwordHash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword(user.passwordHash, testPassword), true);
  assert.equal(memory.sessions.size, 0);
});

test('duplicate email is rejected after normalization', async () => {
  const { browser } = setup();
  assert.equal((await browser.register('person@example.test')).status, 201);
  assert.equal((await browser.register(' PERSON@EXAMPLE.TEST ')).status, 409);
});

test('invalid account fields, short passwords and administrator-role injection are rejected', async () => {
  const { browser, memory } = setup();
  await browser.csrf();
  for (const input of [
    { email: 'bad', password: 'short' },
    { email: 'person@example.test', password: testPassword, firstName: '', lastName: 'User' },
    { email: 'person@example.test', password: 'short', firstName: 'Test', lastName: 'User' },
    { email: 'person@example.test', password: testPassword, firstName: 'Test', lastName: 'User', role: 'admin' },
    ['not', 'an', 'object']
  ]) assert.equal((await browser.post('/auth/register', input)).status, 400);
  assert.equal(memory.users.size, 0);
});

test('login uses HttpOnly cookies and stores session/CSRF hashes without exposing password hashes', async () => {
  const { browser, memory } = setup();
  await browser.register('person@example.test');
  const response = await browser.login('person@example.test');
  assert.equal(response.status, 200);
  assert.ok(response.headers['set-cookie'].every(cookie => cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax')));
  const raw = browser.cookies.get('bytetech_session');
  assert.equal(memory.sessions.has(raw), false);
  assert.equal(memory.sessions.get(hashToken(raw)).csrfTokenHash, hashToken(response.body.csrfToken));
  const me = await browser.request('GET', '/users/me');
  assert.equal(me.status, 200);
  assert.deepEqual(Object.keys(me.body.user).sort(), ['email','firstName','id','lastName','role']);
  assert.equal(me.headers['cache-control'], 'no-store');
});

test('unknown email and incorrect password receive the same login error', async () => {
  const { browser } = setup();
  await browser.register('person@example.test');
  const wrong = await browser.login('person@example.test', 'Wrong password!');
  const unknown = await browser.login('unknown@example.test', 'Wrong password!');
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
});

test('missing, modified and forged anonymous CSRF values are rejected', async () => {
  const { browser, app } = setup();
  await browser.csrf();
  const input = { firstName: 'Test', lastName: 'User', email: 'person@example.test', password: testPassword };
  assert.equal((await browser.request('POST','/auth/register',input)).status, 403);
  assert.equal((await browser.post('/auth/register',input,{headers:{'x-csrf-token':'forged'}})).status, 403);
  const attacker = client(app);
  attacker.csrfToken = 'a'.repeat(64)+'.'+(Date.now()+60000)+'.'+'b'.repeat(64);
  attacker.cookies.set('bytetech_csrf',attacker.csrfToken);
  assert.equal((await attacker.post('/auth/register',input)).status, 403);
});

test('mutations reject missing/untrusted origins and incorrect content types', async () => {
  const { browser } = setup();
  await browser.csrf();
  const input = { email:'person@example.test', password:testPassword };
  for (const origin of ['https://evil.example','http://localhost:5173.evil.example','null',undefined]) {
    assert.equal((await browser.post('/auth/login',input,{headers:{origin}})).status, 403);
  }
  assert.equal((await browser.post('/auth/login',input,{headers:{'content-type':'text/plain'}})).status, 415);
});

test('successful login rotates the session and revokes its predecessor', async () => {
  const { browser, memory, app } = setup();
  await browser.register('person@example.test');
  await browser.login('person@example.test');
  const first = browser.cookies.get('bytetech_session');
  await browser.login('person@example.test');
  assert.notEqual(browser.cookies.get('bytetech_session'), first);
  assert.equal(memory.sessions.has(hashToken(first)), false);
  const replay = client(app);
  replay.cookies.set('bytetech_session', first);
  assert.equal((await replay.request('GET','/users/me')).status, 401);
});

test('expired sessions deny access and allow a new login', async () => {
  const { browser, memory } = setup();
  await browser.register('person@example.test');
  await browser.login('person@example.test');
  memory.sessions.get(hashToken(browser.cookies.get('bytetech_session'))).expiresAt = new Date(0);
  assert.equal((await browser.request('GET','/users/me')).status, 401);
  assert.equal((await browser.request('GET','/cart')).status, 401);
  assert.equal((await browser.login('person@example.test')).status, 200);
});

test('logout revokes authentication while addresses and cart survive the next login', async () => {
  const { browser, app } = setup();
  await browser.register('person@example.test');
  await browser.login('person@example.test');
  await browser.post('/addresses',address);
  await browser.post('/cart/items',{productId:1,quantity:2});
  const token = browser.cookies.get('bytetech_session');
  assert.equal((await browser.post('/auth/logout',{})).status, 204);
  assert.equal(browser.cookies.size, 0);
  const replay = client(app);
  replay.cookies.set('bytetech_session',token);
  assert.equal((await replay.request('GET','/cart')).status, 401);
  await browser.login('person@example.test');
  assert.equal((await browser.request('GET','/addresses')).body.addresses.length,1);
  assert.equal((await browser.request('GET','/cart')).body.cart.items[0].quantity,2);
});

test('authenticated session and CSRF tokens survive application recreation', async () => {
  const { browser, memory } = setup();
  await browser.register('person@example.test');
  await browser.login('person@example.test');
  const resumed = client(createApp({db:{},stores:memory}));
  for (const [name,value] of browser.cookies) resumed.cookies.set(name,value);
  resumed.csrfToken = browser.csrfToken;
  assert.equal((await resumed.request('GET','/users/me')).status, 200);
  assert.equal((await resumed.post('/addresses',address)).status, 201);
  assert.equal((await resumed.post('/cart/items',{productId:1,quantity:1})).status, 201);
});

test('family accounts share locations while retaining their own delivery contacts', async () => {
  const { browser, app, memory } = setup();
  await browser.register('first@example.test');
  await browser.login('first@example.test');
  const first = await browser.post('/addresses',address);
  const other = client(app);
  await other.register('second@example.test');
  await other.login('second@example.test');
  assert.deepEqual((await other.request('GET','/addresses')).body.addresses,[]);
  const second = await other.post('/addresses',{...address,recipientName:'Family Member',phone:'+40 722 345 678'});
  assert.equal(second.body.address.id,first.body.address.id);
  assert.equal(memory.locations.length,1);
  assert.equal(memory.addressLinks.size,2);
  await other.post('/addresses',{...address,recipientName:'Updated Family Member'});
  assert.equal(memory.addressLinks.size,2);
  assert.equal((await browser.request('GET','/addresses')).body.addresses[0].recipientName,address.recipientName);
  assert.equal((await other.request('GET','/addresses')).body.addresses[0].recipientName,'Updated Family Member');
});

test('address operations require login and reject arbitrary ownership or address IDs', async () => {
  const { browser } = setup();
  assert.equal((await browser.request('GET','/addresses')).status,401);
  await browser.register('person@example.test');
  await browser.login('person@example.test');
  assert.equal((await browser.post('/addresses',{...address,userId:99})).status,400);
  assert.equal((await browser.post('/addresses',{addressId:99})).status,400);
});

test('invalid address fields are rejected before storage', async () => {
  const { browser, memory } = setup();
  await browser.register('person@example.test');
  await browser.login('person@example.test');
  for (const input of [{...address,city:''},{...address,phone:'bad'},{...address,addressLine:'x'.repeat(256)},{...address,postalCode:'<bad>'}]) {
    assert.equal((await browser.post('/addresses',input)).status,400);
  }
  assert.equal(memory.locations.length,0);
});

test('login attempts are rate limited', async () => {
  const { browser } = setup({attemptLimit:2});
  await browser.csrf();
  for(let i=0;i<2;i++) assert.equal((await browser.post('/auth/login',{email:'unknown@example.test',password:testPassword})).status,401);
  assert.equal((await browser.post('/auth/login',{email:'unknown@example.test',password:testPassword})).status,429);
});

test('long Unicode passwords are checked in full beyond byte 72', async () => {
  const { browser } = setup();
  const password = '🔒'.repeat(25)+'correct tail';
  assert.ok(Buffer.byteLength(password)>72);
  assert.equal((await browser.register('unicode@example.test',password)).status,201);
  assert.equal((await browser.login('unicode@example.test',password)).status,200);
  assert.equal((await browser.login('unicode@example.test','🔒'.repeat(25)+'wrong tail')).status,401);
});

test('production sessions use Secure HttpOnly cookies with the __Host- prefix', async () => {
  const { browser } = setup({sessionOptions:{secureCookies:true}});
  await browser.register('person@example.test');
  const response = await browser.login('person@example.test');
  assert.ok(response.headers['set-cookie'].every(cookie=>cookie.startsWith('__Host-')&&cookie.includes('Secure')&&cookie.includes('HttpOnly')&&cookie.includes('Path=/')));
});

test('database failures and unexpected errors return safe JSON responses', async () => {
  for (const [error,status] of [[Object.assign(new Error('private SQL/password'),{code:'ECONNREFUSED'}),503],[new Error('private SQL/password'),500]]) {
    const memory=memoryStores();
    memory.accounts.createUser=async()=>{throw error;};
    const browser=client(createApp({db:{},stores:memory,logger:{error(){}}}));
    const response=await browser.register('person@example.test');
    assert.equal(response.status,status);
    assert.doesNotMatch(JSON.stringify(response.body),/private SQL|password/);
  }
});

test('health routes, CORS, unknown routes and JSON error responses remain available', async () => {
  const { browser }=setup();
  assert.equal((await browser.request('GET','')).body.name,'ByteTech API');
  const health=await browser.request('GET','/health');
  assert.equal(health.status,200);
  assert.equal(health.headers['access-control-allow-credentials'],'true');
  assert.equal((await browser.request('GET','/ready')).status,503);
  assert.equal((await browser.request('GET','/missing')).status,404);
  assert.equal((await browser.request('POST','/missing',undefined,{rawBody:'{broken'})).status,400);
  assert.equal((await browser.request('POST','/missing',{data:'x'.repeat(110000)})).status,413);
});

test('configuration validates origins, ports and session duration', () => {
  const env={DB_USER:'test',DB_PASSWORD:'test',DB_DATABASE:'test'};
  assert.equal(readConfig(env).sessionOptions.sessionTtlHours,24);
  assert.equal(readConfig({...env,NODE_ENV:'production'}).sessionOptions.secureCookies,true);
  for (const CORS_ORIGIN of ['*','http://','https://example.test/path','https://example.test/']) assert.throws(()=>readConfig({...env,CORS_ORIGIN}));
  for (const SESSION_TTL_HOURS of ['0','169','bad']) assert.throws(()=>readConfig({...env,SESSION_TTL_HOURS}));
  assert.throws(()=>readConfig({...env,PORT:'0'}));
});
