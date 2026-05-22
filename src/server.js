const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'mysecretkey';

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Servir archivos estáticos desde la carpeta actual (__dirname),
// así `style.css` y `script.js` estarán accesibles en /style.css y /script.js
app.use(express.static(path.join(__dirname, '.')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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
