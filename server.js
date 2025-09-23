const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const authRoutes = require('./routes/auth');
const campRoutes = require('./routes/camps');
const donationRoutes = require('./routes/donations');
const inventoryRoutes = require('./routes/inventory');
const requestRoutes = require('./routes/requests');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reliefhub';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
  // Create default collector user
  createDefaultUsers();
})
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'reliefhub-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI
  }),
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/camps', campRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/requests', requestRoutes);

// Serve static HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/collector-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collector-dashboard.html'));
});

app.get('/official-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'official-dashboard.html'));
});

app.get('/donor-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'donor-dashboard.html'));
});

// Create default users function
async function createDefaultUsers() {
  const User = require('./models/User');
  const bcrypt = require('bcryptjs');
  
  try {
    // Check if collector exists
    const existingCollector = await User.findOne({ username: 'collector' });
    if (!existingCollector) {
      const hashedPassword = await bcrypt.hash('collector123', 10);
      await User.create({
        username: 'collector',
        password: hashedPassword,
        role: 'Collector',
        email: 'collector@reliefhub.com'
      });
      console.log('Default collector user created');
    }
  } catch (error) {
    console.error('Error creating default users:', error);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`ReliefHub server running on port ${PORT}`);
});