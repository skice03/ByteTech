# ByteTech database design

This model covers only the mandatory A1-A12 requirements in pages 2-3 of [Project Specification.pdf](<Project Specification.pdf>). The specification defines required behavior, not a required number of tables. The design uses 13 tables, with every table supporting that behavior.

Paste [relational-model.dbml](relational-model.dbml) into [dbdiagram.io](https://dbdiagram.io/d) to render the relational model. Its exported image is [relational model.png](<relational model.png>). This is a design document: the current API scaffold does not create tables or implement the store features.

For the table-and-diamond ERD, paste the entire [ERD-model.dot](ERD-model.dot) file into [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/) using the `dot` layout engine. Its exported image is [ERD model.png](<ERD model.png>). It shows all attributes, PK/FK/UK markers, named relationship diamonds and explicit cardinalities. These two editable diagram files describe the same 13-table model. Re-export the images whenever their source files change.

`PK` identifies a primary key, `FK` a foreign key, and `UK` an individually unique field. Multiple fields marked `PK` form one composite key. The diamond states the maximum ratio (`1:N` or `1:1`); the connecting lines show `1` (exactly one), `0..N` (zero or many), `1..N` (one or many), or `0..1` (zero or one) at the corresponding table end. For example, one product appears in zero or many order items, and each order item references exactly one product. An order item has at most one stock reservation because they share the composite key `(order_id, product_id)`.

**Requirements mapped to the database**

| Requirement | Tables and fields that support it | What future application code must do |
| --- | --- | --- |
| A1 — Product catalog | `categories`, `products`, `product_images`: category, name, description, RON price, stock and ordered images. | Seed at least 30 products across at least four categories, with an image, price and stock for each. Paginate at no more than 24 products per page; provide category and product pages. |
| A2 — Basic search | `products.name`. | Search product names and show a clear empty-result message. No separate search table is needed. |
| A3 — Shopping cart | `cart_items`, keyed by `(user_id, product_id)`, with a positive quantity. | Add/update/remove items, reject quantities above available stock, and calculate totals on the server. Logout must leave these rows intact. |
| A4 — User accounts | `users`, `user_sessions`, `user_addresses`. | Register, hash passwords with bcrypt or Argon2, log in/out, expire/revoke sessions, and let users save delivery addresses. |
| A5 — Checkout | `shipping_methods`, `orders`, `order_items`. Orders contain one delivery-address snapshot, method name, delivery cost, totals and a unique order number. | Offer at least two methods with different costs; validate address ownership, calculate the summary and show the order number. |
| A6 — Sandbox payment | `payments`, `payment_events`, `orders.status`. | Use Stripe test mode. Verify signed webhook confirmation, payment/order association, amount and RON currency before marking an order paid. Failed payment leaves it unpaid. |
| A7 — Stock management | `products.stock_quantity`, `stock_reservations`, order stock-change timestamps and payment-event IDs. | Lock rows during reservation/payment/cancellation, prevent overselling, decrease on confirmed payment and restore once on cancellation. |
| A8 — Order history | `orders.user_id`, `created_at`, `status`, totals and item snapshots. | Return only the current user's orders with their date, products, total and status. |
| A9 — Administration | `users.role`, categories/products/images, and indexed order status. | Enforce administrator access, product/category CRUD and image upload, list orders by status and validate status transitions. |
| A10 — Basic security | Password/session/CSRF hashes, role and ownership foreign keys, unique keys and checks. | Validate inputs, parameterize SQL, verify CSRF tokens and enforce ownership/roles on the server. A schema alone cannot enforce these application protections. |
| A11 — Responsive design | No additional tables. | Make customer-facing pages usable at 360 px. |
| A12 — Automated tests | No additional tables. | Add at least ten tests covering cart behavior, total calculation and payment confirmation. |

**Model structure**

Product details fit in `description`; category and product pages use their numeric IDs. The model contains only fields and relationships supporting the mandatory store behavior.

A user's cart is their rows in `cart_items`. Each order contains one delivery-address snapshot directly in `orders`. This avoids separate tables for empty cart records and one-to-one delivery-address records.

`is_active` remains on products, categories and delivery methods so they can be removed from current use while existing orders retain valid references. Admin deletion deactivates records that are part of order history. Physical deletion of referenced historical data is restricted by foreign keys.

**Money and history**

All amounts use `DECIMAL(10,2)` directly in RON: `12.00` means 12 RON, and `12.99` means 12.99 RON. Fields are named `price`, `cost`, `subtotal`, `shipping_cost`, `total`, `unit_price` and `amount`. They must be nonnegative, and `orders.total` must equal its subtotal plus shipping cost. Future server calculations must use exact decimal arithmetic; the Stripe adapter will handle the provider's required amount representation.

Order items copy the purchased name and unit price. Orders copy delivery details, delivery method name and cost instead of depending on editable saved-address records. Changes to a product, address or delivery method therefore do not rewrite order history. The service must also verify that the subtotal equals the sum of `quantity * unit_price` across the order's items.

**Why sessions, payment events and reservations remain**

These support mandatory behavior. `user_sessions` stores hashed login/CSRF tokens and expiry, allowing logout and protected browser mutations. Raw session tokens belong in HttpOnly cookies. Session storage does not replace password hashing, CSRF validation or role checks in the future API.

`payment_events` stores only successfully processed, signature-verified events. Its Stripe event ID is the primary key. Insert the event in the same transaction as the associated payment/order/stock changes; failed processing rolls back and remains retryable. The service must also lock/check the order and payment because different event IDs can refer to the same payment. Unknown or irrelevant events must not be recorded as successfully applied order changes.

`stock_reservations` protects units during checkout without immediately reducing on-hand stock. Its composite foreign key requires a matching order item, and the service must make its quantity match that item. Available stock is `stock_quantity - SUM(quantity of reserved rows)`. Checkout must check current availability and insert reservations while holding product row locks in a consistent order. Use current reads or an appropriate isolation level so reservation totals cannot come from an outdated transaction snapshot.

A signed successful-payment webhook must verify the expected amount, currency and stored provider IDs, then atomically mark payment/order paid, consume reservations, decrease stock and set `stock_deducted_at`. A retry must not repeat the decrease. Reserve stock before creating a Checkout Session; reuse the persisted idempotency key if session creation times out. Only one payable attempt for an order may remain open at a time; reconcile/expire the previous session before creating another. Checking the database alone cannot prevent Stripe from charging two independently open sessions.

`expires_at` marks a cleanup deadline, not automatic permission to release a reservation. Confirm that Stripe can no longer collect payment for the attempt before release; this prevents a delayed payment from claiming units already sold elsewhere. A paid-order cancellation restores stock once and records `stock_restored_at`.

Orders follow `new → paid → shipped → delivered`, or `cancelled`. A failed attempt leaves the order `new`, shown as Unpaid. Only verified payment confirmation performs the transition to Paid; an admin update or browser redirect cannot do that. Cancelling an unpaid order releases reservations once payment has been prevented; it does not increase on-hand stock, since no stock was deducted.

The checks and foreign keys validate structure. The full transactional workflows, authorization, minimum seed counts, image validation and tests remain future implementation tasks.
