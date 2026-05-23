-- Esquema de la base de datos para Neon Store

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT,
  instagram TEXT,
  date DATETIME DEFAULT (datetime('now')),
  status TEXT DEFAULT 'Pendiente',
  total REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  provider TEXT NOT NULL DEFAULT 'local',
  provider_id TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(provider, provider_id)
);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
