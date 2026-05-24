const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const bcrypt = require('bcrypt');
const { get, run, all } = require('./database/db');

const fs = require('fs');
const app = express();

// EARLY SECURITY: block direct requests to server-side files before any middleware
app.use((req, res, next) => {
  try {
    const p = (req.path || '').toLowerCase();
    if (p.includes('server.js') || (p.endsWith('.js') && p !== '/script.js') || p.includes('/database/')) {
      console.warn('[EARLY-BLOCK] Blocking request:', req.method, req.path);
      return res.status(403).send('Forbidden');
    }
  } catch (e) {}
  return next();
});

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'mysecretkey';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
const allowedOrigins = new Set([BASE_URL, `http://127.0.0.1:${PORT}`]);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(morgan('dev'));
// Log incoming requests (debug)
app.use((req, res, next) => { console.log('[REQ]', req.method, req.path); next(); });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'neon-store-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Security: hide framework fingerprint
app.disable('x-powered-by');



// Prevent exposing server source files, DB files or other sensitive assets
const forbiddenPaths = ['/server.js', '/package.json', '/package-lock.json', '/.env'];
app.use((req, res, next) => {
  try {
    const p = (req.path || '').toLowerCase();
    if (forbiddenPaths.includes(p) || p.startsWith('/database') || p.includes('.sqlite') || p.endsWith('.db') || p.includes('.git')) {
      console.warn('Blocked sensitive path request:', req.path);
      return res.status(403).send('Forbidden');
    }
  } catch (e) {
    // fallthrough
  }
  return next();
});

// Explicitly block direct access to server source file
app.get('/server.js', (req, res) => res.status(403).send('Forbidden'));

// Block requests to server-side JS files while allowing client script.js
app.use((req, res, next) => {
  try {
    if (req.method === 'GET' && req.path && req.path.toLowerCase().endsWith('.js') && req.path.toLowerCase() !== '/script.js') {
      console.warn('Blocked .js file request:', req.path);
      return res.status(403).send('Forbidden');
    }
  } catch (e) {}
  return next();
});

// Serve static assets (only files we expect in the public app)
const publicDir = path.basename(__dirname) === 'src' ? __dirname : path.join(__dirname, 'src');
app.use((req, res, next) => {
  try {
    const p = req.path || '/';
    const srcFile = path.join(publicDir, p); // Cambiado __dirname por publicDir
    console.log('[STATIC-LOOKUP]', p, 'srcExists=', fs.existsSync(srcFile));
  } catch (e) {}
  return next();
});
// Whitelist static files to avoid accidental exposure of server files
const allowedStatic = new Set(['/index.html', '/script.js', '/style.css', '/favicon.ico', '/']);
app.use((req, res, next) => {
  const p = req.path || '/';
  // allow directory root
  if (allowedStatic.has(p) || allowedStatic.has(p.toLowerCase())) return next();
  // allow asset under /assets or images if needed
  if (p.startsWith('/assets/') || p.startsWith('/images/')) return next();
  // if request looks like a file and is not whitelisted, block
  if (p.includes('.') ) {
    console.warn('Blocked non-whitelisted static request:', p);
    return res.status(403).send('Forbidden');
  }
  return next();
});

async function initializeDatabaseSchema() {
  try {
    const usersInfo = await all('PRAGMA table_info(users)');
    const columns = usersInfo.map(col => col.name);
    if (!columns.includes('role')) {
      await run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'");
    }
    if (!columns.includes('phone')) {
      await run('ALTER TABLE users ADD COLUMN phone TEXT');
    }
    await run(`CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    // Notifications / order requests tables
    await run(`CREATE TABLE IF NOT EXISTS order_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      customer_name TEXT NOT NULL,
      phone TEXT,
      instagram TEXT,
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'Pendiente',
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);

    await run(`CREATE TABLE IF NOT EXISTS order_request_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      nombre TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(request_id) REFERENCES order_requests(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    const existingAdmin = await get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!existingAdmin) {
      const existingNeonAdmin = await get('SELECT id FROM users WHERE username = ?', ['neonadmin']);
      if (existingNeonAdmin) {
        await run("UPDATE users SET role = 'admin' WHERE id = ?", [existingNeonAdmin.id]);
        console.log('Usuario existente neonadmin promovido a admin automáticamente');
      } else {
        const passwordHash = await bcrypt.hash('Neon1234', 10);
        await run(
          'INSERT INTO users (username, password_hash, full_name, photo_url, role, provider) VALUES (?, ?, ?, ?, ?, ?)',
          ['neonadmin', passwordHash, 'Administrador Neon', '', 'admin', 'local']
        );
        console.log('Usuario admin creado automáticamente: neonadmin / Neon1234');
      }
    }
  } catch (err) {
    console.error('Error inicializando esquema de base de datos:', err);
  }
}

initializeDatabaseSchema();

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, phone, role, provider, provider_id AS providerId FROM users WHERE id = ?', [id])
    .then(user => done(null, user || false))
    .catch(err => done(err));
});

passport.use(new LocalStrategy({ usernameField: 'username', passwordField: 'password' }, async (username, password, done) => {
  try {
    const user = await get('SELECT * FROM users WHERE username = ? AND provider = ?', [username, 'local']);
    if (!user) return done(null, false, { message: 'Usuario o contraseña incorrectos' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return done(null, false, { message: 'Usuario o contraseña incorrectos' });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

async function findOrCreateSocialUser(profile, provider, done) {
  try {
    const providerId = profile.id;
    let user = await get('SELECT * FROM users WHERE provider = ? AND provider_id = ?', [provider, providerId]);
    if (user) return done(null, user);

    const rawName = profile.displayName || `${provider}-${providerId}`;
    const baseUsername = rawName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 18) || `${provider}${providerId}`;
    let username = baseUsername;
    let counter = 1;
    while (await get('SELECT 1 FROM users WHERE username = ?', [username])) {
      username = `${baseUsername}${counter++}`;
    }

    const fullName = profile.displayName || username;
    const photoUrl = (profile.photos && profile.photos.length) ? profile.photos[0].value : '';
    const result = await run(
      'INSERT INTO users (username, password_hash, full_name, photo_url, provider, provider_id) VALUES (?, ?, ?, ?, ?, ?)',
      [username, '', fullName, photoUrl, provider, providerId]
    );
    user = await get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, provider, provider_id AS providerId FROM users WHERE id = ?', [result.id]);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET',
  callbackURL: `${BASE_URL}/auth/google/callback`
}, (accessToken, refreshToken, profile, done) => findOrCreateSocialUser(profile, 'google', done)));

passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID || 'FACEBOOK_APP_ID',
  clientSecret: process.env.FACEBOOK_APP_SECRET || 'FACEBOOK_APP_SECRET',
  callbackURL: `${BASE_URL}/auth/facebook/callback`,
  profileFields: ['id', 'displayName', 'photos', 'email']
}, (accessToken, refreshToken, profile, done) => findOrCreateSocialUser(profile, 'facebook', done)));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ status: 'error', message: 'No autorizado' });
}

function ensureAdmin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ status: 'error', message: 'Acceso prohibido: solo administradores' });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.post('/auth/register', async (req, res, next) => {
  try {
    const { username, password, fullName, photoUrl, phone } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Debe completar todos los campos' });
    }

    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password_hash, full_name, photo_url, phone, role, provider) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash, fullName, photoUrl || '', phone || '', 'customer', 'local']
    );
    const user = await get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, phone, role, provider, provider_id AS providerId FROM users WHERE id = ?', [result.id]);
    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ status: 'success', user });
    });
  } catch (err) {
    next(err);
  }
});


app.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'No autorizado' });
    req.login(user, (error) => {
      if (error) return next(error);
      return res.json({ status: 'success', user });
    });
  })(req, res, next);
});

app.post('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ status: 'success' });
  });
});

app.get('/auth/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(200).json({ status: 'unauthenticated' });
  }
  res.json({ status: 'success', user: req.user });
});

app.put('/auth/profile', async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { username, fullName, photoUrl, phone } = req.body;
    if (!username || !fullName) {
      return res.status(400).json({ error: 'Debe completar todos los campos' });
    }

    if (username !== req.user.username) {
      const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
      if (existing) {
        return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
      }
    }

    await run(
      'UPDATE users SET username = ?, full_name = ?, photo_url = ?, phone = ? WHERE id = ?',
      [username, fullName, photoUrl || '', phone || '', req.user.id]
    );

    const user = await get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, phone, role, provider, provider_id AS providerId FROM users WHERE id = ?', [req.user.id]);
    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ status: 'success', user });
    });
  } catch (err) {
    next(err);
  }
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

app.get('/api/products', ensureAuthenticated, async (req, res, next) => {
  try {
    const rows = await all('SELECT * FROM products ORDER BY category, name');
    res.json({ status: 'success', products: rows });
  } catch (err) {
    next(err);
  }
});

app.post('/api/products', ensureAdmin, async (req, res, next) => {
  try {
    const { name, category, price, stock, image } = req.body;
    if (!name || !category || price == null || stock == null) {
      return res.status(400).json({ status: 'error', message: 'Datos incompletos para producto' });
    }
    const result = await run('INSERT INTO products (name, category, price, stock, image) VALUES (?, ?, ?, ?, ?)',
      [name, category, Number(price), Number(stock), image || '']);
    const product = await get('SELECT * FROM products WHERE id = ?', [result.id]);
    res.json({ status: 'success', product });
  } catch (err) {
    next(err);
  }
});

app.put('/api/products/:id', ensureAdmin, async (req, res, next) => {
  try {
    const { name, category, price, stock, image } = req.body;
    const productId = Number(req.params.id);
    if (!name || !category || price == null || stock == null) {
      return res.status(400).json({ status: 'error', message: 'Datos incompletos para producto' });
    }
    await run('UPDATE products SET name = ?, category = ?, price = ?, stock = ?, image = ? WHERE id = ?',
      [name, category, Number(price), Number(stock), image || '', productId]);
    const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
    res.json({ status: 'success', product });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/products/:id', ensureAdmin, async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    await run('DELETE FROM products WHERE id = ?', [productId]);
    res.json({ status: 'success', message: 'Producto eliminado' });
  } catch (err) {
    next(err);
  }
});

app.get('/api/orders', ensureAdmin, async (req, res, next) => {
  try {
    const orders = await all('SELECT * FROM orders ORDER BY date DESC');
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const items = await all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      return { ...order, items };
    }));
    res.json({ status: 'success', orders: ordersWithItems });
  } catch (err) {
    next(err);
  }
});

app.post('/api/orders', ensureAuthenticated, async (req, res, next) => {
  try {
    const { customerName, phone, instagram, date, status, items, total } = req.body;
    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Orden inválida' });
    }
    const orderResult = await run('INSERT INTO orders (customer_name, phone, instagram, date, status, total) VALUES (?, ?, ?, ?, ?, ?)',
      [customerName, phone || '', instagram || '', date || new Date().toISOString().split('T')[0], status || 'Pendiente', Number(total)]);
    await Promise.all(items.map(async (item) => {
      await run('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderResult.id, item.productId, Number(item.quantity), Number(item.price)]);
      await run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [Number(item.quantity), item.productId, Number(item.quantity)]);
    }));
    // If this order was created from a prior request, remove the request
    if (req.body.requestId) {
      const reqId = Number(req.body.requestId);
      if (!Number.isNaN(reqId)) {
        await run('DELETE FROM order_request_items WHERE request_id = ?', [reqId]);
        await run('DELETE FROM order_requests WHERE id = ?', [reqId]);
      }
    }
    res.json({ status: 'success', orderId: orderResult.id });
  } catch (err) {
    next(err);
  }
});

// Order requests (notifications) endpoints
app.post('/api/requests', ensureAuthenticated, async (req, res, next) => {
  try {
    const { customerName, phone, instagram, items, total } = req.body;
    console.log('[POST /api/requests] Recibido:', { customerName, phone, instagram, itemsCount: items?.length, total });
    
    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      console.warn('[POST /api/requests] Validación fallida - datos incompletos');
      return res.status(400).json({ status: 'error', message: 'Solicitud inválida' });
    }
    
    const insertReq = await run('INSERT INTO order_requests (user_id, username, customer_name, phone, instagram, amount) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, req.user.username, customerName, phone || '', instagram || '', Number(total) || 0]);
    
    const requestId = insertReq.id;
    console.log('[POST /api/requests] Solicitud insertada con ID:', requestId);
    
    if (!requestId) {
      console.error('[POST /api/requests] ERROR: No se obtuvo ID válido de la inserción');
      return res.status(500).json({ status: 'error', message: 'Error al crear la solicitud' });
    }
    
    await Promise.all((items || []).map(async (it) => {
      console.log('[POST /api/requests] Insertando item:', { requestId, productId: it.idProducto || it.productId, nombre: it.nombre, cantidad: it.cantidad || it.quantity });
      await run('INSERT INTO order_request_items (request_id, product_id, nombre, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [requestId, it.idProducto || it.productId, it.nombre || '', Number(it.cantidad || it.quantity || 1), Number(it.precioUnitario || it.price || 0)]);
    }));
    
    console.log('[POST /api/requests] Solicitud completada exitosamente:', requestId);
    res.json({ status: 'success', requestId });
  } catch (err) {
    console.error('[POST /api/requests] ERROR:', err);
    next(err);
  }
});

// Alternate route (without /api) redirects to /api/requests
app.post('/requests', ensureAuthenticated, async (req, res, next) => {
  try {
    const { customerName, phone, instagram, items, total } = req.body;
    console.log('[POST /requests] Recibido:', { customerName, phone, instagram, itemsCount: items?.length, total });
    
    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      console.warn('[POST /requests] Validación fallida');
      return res.status(400).json({ status: 'error', message: 'Solicitud inválida' });
    }
    
    const insertReq = await run('INSERT INTO order_requests (user_id, username, customer_name, phone, instagram, amount) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, req.user.username, customerName, phone || '', instagram || '', Number(total) || 0]);
    const requestId = insertReq.id;
    
    console.log('[POST /requests] Solicitud insertada con ID:', requestId);
    
    if (!requestId) {
      console.error('[POST /requests] ERROR: No se obtuvo ID válido');
      return res.status(500).json({ status: 'error', message: 'Error al crear la solicitud' });
    }
    
    await Promise.all((items || []).map(async (it) => {
      await run('INSERT INTO order_request_items (request_id, product_id, nombre, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [requestId, it.idProducto || it.productId, it.nombre || '', Number(it.cantidad || it.quantity || 1), Number(it.precioUnitario || it.price || 0)]);
    }));
    
    console.log('[POST /requests] Solicitud completada');
    res.json({ status: 'success', requestId });
  } catch (err) {
    console.error('[POST /requests] ERROR:', err);
    next(err);
  }
});

app.get('/api/requests', ensureAdmin, async (req, res, next) => {
  try {
    console.log('[GET /api/requests] Admin:', req.user?.username);
    const requests = await all('SELECT * FROM order_requests ORDER BY created_at DESC');
    console.log('[GET /api/requests] Solicitudes encontradas:', requests.length);
    
    const withItems = await Promise.all(requests.map(async (r) => {
      const items = await all('SELECT * FROM order_request_items WHERE request_id = ?', [r.id]);
      console.log('[GET /api/requests] Solicitud ID', r.id, 'con', items.length, 'items');
      return { ...r, items };
    }));
    
    res.json({ status: 'success', requests: withItems });
  } catch (err) {
    console.error('[GET /api/requests] ERROR:', err);
    next(err);
  }
});

app.get('/requests', ensureAdmin, async (req, res, next) => {
  try {
    console.log('[GET /requests] Admin:', req.user?.username);
    const requests = await all('SELECT * FROM order_requests ORDER BY created_at DESC');
    console.log('[GET /requests] Solicitudes encontradas:', requests.length);
    
    const withItems = await Promise.all(requests.map(async (r) => {
      const items = await all('SELECT * FROM order_request_items WHERE request_id = ?', [r.id]);
      return { ...r, items };
    }));
    
    res.json({ status: 'success', requests: withItems });
  } catch (err) {
    console.error('[GET /requests] ERROR:', err);
    next(err);
  }
});

app.put('/api/requests/:id/status', ensureAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!id || !status) return res.status(400).json({ status: 'error', message: 'Invalid' });
    await run('UPDATE order_requests SET status = ? WHERE id = ?', [status, id]);
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
});

app.put('/requests/:id/status', ensureAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!id || !status) return res.status(400).json({ status: 'error', message: 'Invalid' });
    await run('UPDATE order_requests SET status = ? WHERE id = ?', [status, id]);
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/orders/:id', ensureAdmin, async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    await run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await run('DELETE FROM orders WHERE id = ?', [orderId]);
    res.json({ status: 'success', message: 'Orden eliminada' });
  } catch (err) {
    next(err);
  }
});

app.get('/api/likes', ensureAuthenticated, async (req, res, next) => {
  try {
    const likes = await all(`SELECT l.product_id AS productId, l.is_public AS isPublic, p.*
      FROM likes l
      JOIN products p ON p.id = l.product_id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC`, [req.user.id]);
    res.json({ status: 'success', likes });
  } catch (err) {
    next(err);
  }
});

app.post('/api/likes', ensureAuthenticated, async (req, res, next) => {
  try {
    const { productId, isPublic } = req.body;
    if (!productId) {
      return res.status(400).json({ status: 'error', message: 'Falta productId' });
    }
    await run(`INSERT INTO likes (user_id, product_id, is_public) VALUES (?, ?, ?)
      ON CONFLICT(user_id, product_id) DO UPDATE SET is_public = excluded.is_public`,
      [req.user.id, Number(productId), isPublic ? 1 : 0]);
    const like = await get('SELECT * FROM likes WHERE user_id = ? AND product_id = ?', [req.user.id, Number(productId)]);
    res.json({ status: 'success', like });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/likes/:productId', ensureAuthenticated, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    await run('DELETE FROM likes WHERE user_id = ? AND product_id = ?', [req.user.id, productId]);
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
});

app.put('/api/likes/:productId/privacy', ensureAuthenticated, async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const { isPublic } = req.body;
    await run('UPDATE likes SET is_public = ? WHERE user_id = ? AND product_id = ?', [isPublic ? 1 : 0, req.user.id, productId]);
    const updated = await get('SELECT * FROM likes WHERE user_id = ? AND product_id = ?', [req.user.id, productId]);
    res.json({ status: 'success', like: updated });
  } catch (err) {
    next(err);
  }
});

app.get('/api/users/:id/likes', ensureAuthenticated, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const ownProfile = req.user && req.user.id === userId;
    const likes = await all(`SELECT l.product_id AS productId, l.is_public AS isPublic, p.*
      FROM likes l
      JOIN products p ON p.id = l.product_id
      WHERE l.user_id = ? ${ownProfile ? '' : 'AND l.is_public = 1'}
      ORDER BY l.created_at DESC`, [userId]);
    res.json({ status: 'success', likes });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/users', ensureAdmin, async (req, res, next) => {
  try {
    const username = (req.query.username || '').trim();
    if (!username) {
      return res.status(400).json({ status: 'error', message: 'Usuario requerido' });
    }
    const user = await get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, phone, role FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }
    const likes = await all(`SELECT p.*, l.is_public AS isPublic
      FROM likes l
      JOIN products p ON p.id = l.product_id
      WHERE l.user_id = ? AND l.is_public = 1
      ORDER BY l.created_at DESC`, [user.id]);
    res.json({ status: 'success', user, publicLikes: likes });
  } catch (err) {
    next(err);
  }
});

app.put('/api/admin/users/:id/role', ensureAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body;
    if (!['customer', 'admin'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Rol inválido' });
    }
    await run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    const user = await get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, phone, role FROM users WHERE id = ?', [userId]);
    res.json({ status: 'success', user });
  } catch (err) {
    next(err);
  }
});

// Serve static assets after API routes so API endpoints are prioritized first
app.use(express.static(publicDir, { index: false }));

// Debug: listar rutas registradas antes del handler 404
try {
  const routeList = [];
  if (app._router && app._router.stack) {
    app._router.stack.forEach(mw => {
      if (mw.route && mw.route.path) {
        const methods = Object.keys(mw.route.methods).map(m => m.toUpperCase()).join(',');
        routeList.push(`${methods} ${mw.route.path}`);
      }
    });
  }
  console.log('Rutas registradas (antes de 404):');
  routeList.forEach(r => console.log('- ' + r));
} catch (e) {
  console.warn('No se pudieron listar rutas antes de 404:', e);
}

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

// Endpoint de depuración para listar rutas registradas
app.get('/debug/routes', (req, res) => {
  try {
    const routes = (app._router && app._router.stack ? app._router.stack : [])
      .filter(layer => layer.route)
      .map(layer => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
    return res.json({ status: 'success', routes });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: 'No se pudieron obtener rutas' });
  }
});

// Endpoint para diagnosticar estado del usuario actual
app.get('/debug/user', (req, res) => {
  try {
    const isAuth = req.isAuthenticated && req.isAuthenticated();
    console.log('[/debug/user] isAuthenticated:', isAuth, 'user:', req.user);
    res.json({ 
      status: 'success', 
      isAuthenticated: isAuth, 
      user: req.user || null,
      role: req.user?.role || 'none'
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: 'Error en diagnóstico' });
  }
});

// Endpoint para ver todas las solicitudes (cualquier usuario autenticado)
app.get('/debug/requests', ensureAuthenticated, async (req, res, next) => {
  try {
    console.log('[/debug/requests] Usuario:', req.user?.username, 'Rol:', req.user?.role);
    const requests = await all('SELECT * FROM order_requests ORDER BY created_at DESC');
    console.log('[/debug/requests] Total de solicitudes:', requests.length);
    
    const withItems = await Promise.all(requests.map(async (r) => {
      const items = await all('SELECT * FROM order_request_items WHERE request_id = ?', [r.id]);
      return { ...r, items };
    }));
    
    res.json({ 
      status: 'success', 
      totalRequests: requests.length,
      requests: withItems,
      currentUser: { username: req.user?.username, role: req.user?.role }
    });
  } catch (err) {
    console.error('[/debug/requests] ERROR:', err);
    next(err);
  }
});

// 404 handler (moved after debug endpoints so they remain reachable)
app.use((req, res, next) => {
  const error = new Error('Ruta no encontrada');
  error.status = 404;
  next(error);
});

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Error interno del servidor',
  });
});

// Debug: listar rutas registradas (ayuda a diagnosticar 404 inesperados)
try {
  const routeList = [];
  app._router.stack.forEach(mw => {
    if (mw.route && mw.route.path) {
      const methods = Object.keys(mw.route.methods).map(m => m.toUpperCase()).join(',');
      routeList.push(`${methods} ${mw.route.path}`);
    }
  });
  console.log('Rutas registradas:');
  routeList.forEach(r => console.log('- ' + r));
} catch (e) {
  console.warn('No se pudieron listar rutas:', e);
}
