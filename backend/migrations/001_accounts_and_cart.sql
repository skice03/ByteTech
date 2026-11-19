-- Week 4/5: A4 accounts and A3 cart, matching the agreed relational model.
-- Catalog tables are prerequisites for cart references; Alexandru owns A1 data/API.

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  csrf_token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_addresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  address_line VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  UNIQUE KEY uq_address_location (address_line, city, region, postal_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_address_links (
  user_id INT UNSIGNED NOT NULL,
  address_id INT UNSIGNED NOT NULL,
  recipient_name VARCHAR(200) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, address_id),
  INDEX idx_address_links_address (address_id),
  CONSTRAINT fk_address_links_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_address_links_address FOREIGN KEY (address_id) REFERENCES user_addresses(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (price >= 0),
  INDEX idx_products_category_active (category_id, is_active, id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE product_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_image_order (product_id, sort_order),
  CONSTRAINT fk_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE cart_items (
  user_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, product_id),
  CHECK (quantity > 0),
  INDEX idx_cart_product (product_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
