import { HttpError } from './errors.js';

export const maxUnsignedId = 4294967295;

export function object(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'A JSON object is required.');
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new HttpError(400, 'Request contains unsupported fields.');
}

export function text(value, name, max, fields) {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max) {
    fields[name] = `Must contain between 1 and ${max} characters.`;
    return '';
  }
  return value.trim();
}

export function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maxUnsignedId) {
    throw new HttpError(400, `${name} must be a positive integer no greater than ${maxUnsignedId}.`);
  }
  return value;
}

export function pathId(value, name = 'product') {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) throw new HttpError(400, `Invalid ${name} ID.`);
  return positiveInteger(Number(value), `${name}Id`);
}
