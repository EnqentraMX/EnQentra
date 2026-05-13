// server.js - Backend para EnQentra
// Deploy en Render.com (gratis)

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// DATABASE SETUP
const dbPath = path.join(__dirname, 'enquentra.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('✅ Database connected');
});

// Crear tablas si no existen
function initDB() {
  db.run(`
    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      emoji TEXT,
      location TEXT,
      description TEXT,
      whatsapp TEXT,
      facebook TEXT,
      rating REAL DEFAULT 5,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agencyId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      duration TEXT,
      capacity INTEGER,
      price INTEGER,
      category TEXT,
      emoji TEXT,
      rating REAL DEFAULT 5,
      reviews INTEGER DEFAULT 0,
      image TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(agencyId) REFERENCES agencies(id)
    )
  `);
}

initDB();

// ===== RUTAS =====

// GET - Obtener todas las agencias
app.get('/api/agencies', (req, res) => {
  db.all('SELECT * FROM agencies', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET - Obtener una agencia por slug
app.get('/api/agencies/:slug', (req, res) => {
  db.get('SELECT * FROM agencies WHERE slug = ?', [req.params.slug], (err, agency) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!agency) return res.status(404).json({ error: 'Agencia no encontrada' });

    db.all('SELECT * FROM tours WHERE agencyId = ?', [agency.id], (err, tours) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...agency, tours });
    });
  });
});

// POST - Crear agencia
app.post('/api/agencies', (req, res) => {
  const { id, name, slug, emoji, location, description, whatsapp, facebook } = req.body;

  if (!id || !name || !slug) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  db.run(
    'INSERT INTO agencies (id, name, slug, emoji, location, description, whatsapp, facebook) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, slug, emoji || '✨', location, description, whatsapp, facebook],
    (err) => {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Este slug ya existe' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: 'Agencia creada' });
    }
  );
});

// PUT - Actualizar agencia
app.put('/api/agencies/:id', (req, res) => {
  const { name, description, location, emoji, whatsapp, facebook } = req.body;

  db.run(
    'UPDATE agencies SET name = ?, description = ?, location = ?, emoji = ?, whatsapp = ?, facebook = ? WHERE id = ?',
    [name, description, location, emoji, whatsapp, facebook, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Agencia actualizada' });
    }
  );
});

// DELETE - Eliminar agencia
app.delete('/api/agencies/:id', (req, res) => {
  db.run('DELETE FROM agencies WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM tours WHERE agencyId = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ===== TOURS =====

// GET - Obtener tours de una agencia
app.get('/api/tours/agency/:agencyId', (req, res) => {
  db.all('SELECT * FROM tours WHERE agencyId = ?', [req.params.agencyId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET - Obtener todos los tours
app.get('/api/tours', (req, res) => {
  db.all('SELECT * FROM tours', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST - Crear tour
app.post('/api/tours', (req, res) => {
  const { agencyId, name, description, duration, capacity, price, category, emoji, image } = req.body;

  if (!agencyId || !name) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  db.run(
    'INSERT INTO tours (agencyId, name, description, duration, capacity, price, category, emoji, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [agencyId, name, description, duration, capacity, price, category, emoji || '🌿', image],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// PUT - Actualizar tour
app.put('/api/tours/:id', (req, res) => {
  const { name, description, duration, capacity, price, category, emoji, image } = req.body;

  db.run(
    'UPDATE tours SET name = ?, description = ?, duration = ?, capacity = ?, price = ?, category = ?, emoji = ?, image = ? WHERE id = ?',
    [name, description, duration, capacity, price, category, emoji, image, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// DELETE - Eliminar tour
app.delete('/api/tours/:id', (req, res) => {
  db.run('DELETE FROM tours WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ===== STATS =====
app.get('/api/stats', (req, res) => {
  db.get('SELECT COUNT(*) as agencyCount FROM agencies', (err, agencyData) => {
    db.get('SELECT COUNT(*) as tourCount FROM tours', (err, tourData) => {
      db.get('SELECT AVG(rating) as avgRating FROM agencies', (err, ratingData) => {
        res.json({
          agencies: agencyData.agencyCount,
          tours: tourData.tourCount,
          rating: (ratingData.avgRating || 4.8).toFixed(1)
        });
      });
    });
  });
});

// ===== SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 EnQentra API corriendo en http://localhost:${PORT}`);
});
