require('dotenv').config();
const dns = require('dns');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const interactionRoutes = require('./routes/interactions');
const zoneRoutes = require('./routes/zones');
const agentRoutes = require('./routes/agents');
const reviewRoutes = require('./routes/reviews');
const propertyRoutes = require('./routes/properties');
const listingRoutes = require('./routes/listings');
const requirementRoutes = require('./routes/requirements');
const marketplaceRoutes = require('./routes/marketplace');
const instagramRoutes = require('./routes/instagram');
const { seedZones } = require('./seed/zones');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Local disk still used for agent reel videos; listing photos go to S3
fs.mkdirSync(path.join(__dirname, 'uploads', 'videos'), { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (_req, res) => {
  res.json({
    message: 'RealCRM Real Estate Matching API',
    version: '2.4.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/agents/:id/reviews', reviewRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/instagram', instagramRoutes);

app.use((err, _req, res, _next) => {
  if (err?.name === 'MulterError' || /image files|Only video/i.test(err?.message || '')) {
    return res.status(400).json({ message: err.message || 'Upload failed' });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

async function start() {
  const mongoUri = process.env.MONGO_URI;
  const jwtSecret = process.env.JWT_SECRET;

  if (!mongoUri) {
    console.error('MONGO_URI is missing from environment variables');
    process.exit(1);
  }
  if (!jwtSecret || jwtSecret.length < 16) {
    console.error('JWT_SECRET must be set and at least 16 characters');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGO_DB_NAME || undefined,
      serverSelectionTimeoutMS: 15000,
    });
    console.log('MongoDB connected');
    await seedZones();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
      console.log('Android emulator tip: use http://10.0.2.2:' + PORT);
      if (process.env.ADMIN_EMAIL) {
        console.log(`Admin bootstrap email: ${process.env.ADMIN_EMAIL}`);
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
