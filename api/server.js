const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from parent directory (for local running)
app.use(express.static(path.join(__dirname, '..')));

// --------------------------------------------------
// DATABASE SETUP — PostgreSQL via Neon / Vercel Postgres
// --------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        "locationName" TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL
      )
    `);
    console.log('Reports table verified.');
    await seedMockDataIfEmpty();
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
  }
}

async function seedMockDataIfEmpty() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM reports');
  const count = parseInt(result.rows[0].count, 10);

  if (count === 0) {
    console.log('Database empty. Seeding default Accra flood reports...');

    const mockReports = [
      {
        id: "rep-1",
        locationName: "Adabraka Sahara (Near Odaw River)",
        latitude: 5.5600, longitude: -0.2100,
        severity: "critical",
        description: "Odaw River overflowed. Water levels are up to 1.5 meters deep. Ground floor houses are completely submerged. Emergency services are evacuating residents.",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        source: "Crowdsourced (Verified)"
      },
      {
        id: "rep-2",
        locationName: "Kaneshie Market (Interchange Underpass)",
        latitude: 5.5695, longitude: -0.2335,
        severity: "critical",
        description: "Severe street flooding. Underpass is completely flooded and impassable for all vehicles. High traffic gridlock stretching back to Graphic Road.",
        timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
        source: "Official (NADMO)"
      },
      {
        id: "rep-3",
        locationName: "N1 Highway (Apenkwa Interchange)",
        latitude: 5.6025, longitude: -0.2285,
        severity: "critical",
        description: "Deep water logging under the interchange. Multiple compact cars have stalled in the water. Motorists are advised to divert through Tesano or Achimota.",
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        source: "Crowdsourced (Verified)"
      },
      {
        id: "rep-4",
        locationName: "Weija Broadcasting Access Roads",
        latitude: 5.5645, longitude: -0.3245,
        severity: "medium",
        description: "Weija Dam spillage has caused waterlogging on surrounding roads. Vehicles can pass slowly, but sedan cars should avoid the area.",
        timestamp: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
        source: "Official (NADMO)"
      },
      {
        id: "rep-5",
        locationName: "Tse Addo East (Near Trade Fair)",
        latitude: 5.5890, longitude: -0.1480,
        severity: "low",
        description: "Ponding water on secondary unpaved streets. Drive with care. Drainage is slowly moving the water.",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        source: "Crowdsourced"
      }
    ];

    for (const rep of mockReports) {
      await pool.query(
        `INSERT INTO reports (id, "locationName", latitude, longitude, severity, description, timestamp, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [rep.id, rep.locationName, rep.latitude, rep.longitude, rep.severity, rep.description, rep.timestamp, rep.source]
      );
    }
    console.log('Successfully seeded default reports.');
  } else {
    console.log(`Database already has ${count} reports.`);
  }
}

// --------------------------------------------------
// API ENDPOINTS
// --------------------------------------------------

// Get all flood reports
app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to query reports:', err.message);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Submit a new flood report
app.post('/api/reports', async (req, res) => {
  const { locationName, latitude, longitude, severity, description } = req.body;

  if (!locationName || latitude === undefined || longitude === undefined || !severity || !description) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const allowedSeverities = ['low', 'medium', 'critical'];
  if (!allowedSeverities.includes(severity.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid severity level' });
  }

  const newReport = {
    id: 'rep-' + Date.now(),
    locationName: locationName.trim(),
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    severity: severity.toLowerCase(),
    description: description.trim(),
    timestamp: new Date().toISOString(),
    source: 'Crowdsourced'
  };

  try {
    await pool.query(
      `INSERT INTO reports (id, "locationName", latitude, longitude, severity, description, timestamp, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [newReport.id, newReport.locationName, newReport.latitude, newReport.longitude,
       newReport.severity, newReport.description, newReport.timestamp, newReport.source]
    );
    console.log(`New report added: ${newReport.locationName} (${newReport.id})`);
    res.status(201).json(newReport);
  } catch (err) {
    console.error('Failed to insert report:', err.message);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'postgresql' });
});

// Serve frontend SPA for everything else (for local running)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// --------------------------------------------------
// BOOT — Initialize DB then start server
// --------------------------------------------------
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Accra FloodWatch server running...`);
    console.log(`Access locally: http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}).catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
