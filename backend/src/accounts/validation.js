import { HttpError } from '../errors.js';
import { object, text } from '../validation.js';

export function credentials(body, registration = false) {
  object(body, registration ? ['firstName', 'lastName', 'email', 'password'] : ['email', 'password']);
  const fields = {};
  const email = text(body.email, 'email', 254, fields).toLowerCase();
  if ([...email].length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Enter a valid email address.';
  const length = typeof body.password === 'string' ? [...body.password].length : 0;
  const minimum = registration ? 15 : 1;
  if (length < minimum || length > 128) fields.password = `Password must contain ${minimum} to 128 characters.`;
  const result = { email, password: body.password };
  if (registration) {
    result.firstName = text(body.firstName, 'firstName', 100, fields);
    result.lastName = text(body.lastName, 'lastName', 100, fields);
  }
  if (Object.keys(fields).length) throw new HttpError(400, 'Validation failed.', fields);
  return result;
}

export function deliveryAddress(body) {
  const limits = { recipientName: 200, phone: 32, addressLine: 255, city: 100, region: 100, postalCode: 20 };
  object(body, Object.keys(limits));
  const fields = {};
  const result = Object.fromEntries(Object.entries(limits).map(([name, max]) => [name, text(body[name], name, max, fields)]));
  if (!/^\+?[0-9 ().-]+$/.test(result.phone) || !/^\d{7,15}$/.test(result.phone.replace(/\D/g, ''))) {
    fields.phone = 'Enter a phone number containing 7 to 15 digits.';
  }
  if (!/^[\p{L}\p{N} -]+$/u.test(result.postalCode)) fields.postalCode = 'Enter a valid postal code.';
  if (Object.keys(fields).length) throw new HttpError(400, 'Validation failed.', fields);
  return result;
}
