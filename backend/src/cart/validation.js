import { object, positiveInteger } from '../validation.js';

export function addItem(body) {
  object(body, ['productId', 'quantity']);
  return { productId: positiveInteger(body.productId, 'productId'), quantity: positiveInteger(body.quantity, 'quantity') };
}

export function replaceQuantity(body) {
  object(body, ['quantity']);
  return positiveInteger(body.quantity, 'quantity');
}
