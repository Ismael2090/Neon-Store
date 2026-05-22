const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(SCHEMA_PATH)) {
  console.error('No se encontró schema.sql en', SCHEMA_PATH);
  process.exit(1);
}

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.exec(schema, (err) => {
    if (err) {
      console.error('Error aplicando el schema:', err);
      process.exit(1);
    }
    console.log('Schema aplicado correctamente.');

    // Insertar datos de ejemplo solo si la tabla products está vacía
    db.get('SELECT COUNT(1) AS cnt FROM products', (err, row) => {
      if (err) {
        console.error(err);
        return;
      }

      if (row && row.cnt === 0) {
        const insert = db.prepare('INSERT INTO products (name, category, price, stock, image) VALUES (?, ?, ?, ?, ?)');
        insert.run('Anillo Retro', 'Anillos', 9.99, 20, '');
        insert.run('Collar Neon', 'Collares', 19.95, 15, '');
        insert.run('Pulsera Hilo', 'Pulseras', 5.5, 40, '');
        insert.finalize(() => console.log('Productos de ejemplo insertados.'));
      } else {
        console.log('Productos ya existentes, no se insertaron ejemplos.');
      }
    });
  });
});

db.close((err) => {
  if (err) console.error('Error cerrando DB:', err);
  else console.log('Conexión a la base de datos cerrada.');
});
