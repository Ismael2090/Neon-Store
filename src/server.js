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
const { get, run } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'mysecretkey';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'neon-store-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, '.')));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, provider, provider_id AS providerId FROM users WHERE id = ?', [id])
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

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/auth/register', async (req, res, next) => {
  try {
    const { username, password, fullName, photoUrl } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Debe completar todos los campos' });
    }

    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password_hash, full_name, photo_url, provider) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, fullName, photoUrl || '', 'local']
    );
    const user = await get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, provider, provider_id AS providerId FROM users WHERE id = ?', [result.id]);
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

    const { username, fullName, photoUrl } = req.body;
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
      'UPDATE users SET username = ?, full_name = ?, photo_url = ? WHERE id = ?',
      [username, fullName, photoUrl || '', req.user.id]
    );

    const user = await get('SELECT id, username, full_name AS fullName, photo_url AS photoUrl, provider, provider_id AS providerId FROM users WHERE id = ?', [req.user.id]);
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

const apiRouter = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.headers['x-api-key'] || req.headers['authorization'];
  if (token === API_KEY) {
    return next();
  }

  res.status(401).json({
    status: 'error',
    message: 'No autorizado',
  });
};

apiRouter.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'API disponible',
  });
});

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

apiRouter.post('/echo', (req, res) => {
  res.json({
    status: 'success',
    data: req.body,
  });
});

apiRouter.put('/user/:id', (req, res) => {
  res.json({
    status: 'success',
    message: `Usuario ${req.params.id} actualizado`,
    payload: req.body,
  });
});

apiRouter.delete('/user/:id', (req, res) => {
  res.json({
    status: 'success',
    message: `Usuario ${req.params.id} eliminado`,
  });
});

app.use('/api', apiRouter);

// 404 handler
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

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
