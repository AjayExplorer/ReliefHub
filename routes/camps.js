const express = require('express');
const { body, validationResult } = require('express-validator');
const Camp = require('../models/Camp');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all camps
router.get('/', requireAuth, async (req, res) => {
  try {
    const camps = await Camp.find()
      .populate('assignedOfficials', 'username email')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
    
    res.json(camps);
  } catch (error) {
    console.error('Error fetching camps:', error);
    res.status(500).json({ error: 'Failed to fetch camps' });
  }
});

// Create camp (Collector only)
router.post('/', [requireAuth, requireRole(['Collector'])], [
  body('campName').notEmpty().withMessage('Camp name is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('strength').isInt({ min: 1 }).withMessage('Strength must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { campName, location, strength, description } = req.body;

    const camp = new Camp({
      campName,
      location,
      strength,
      description,
      createdBy: req.session.userId
    });

    await camp.save();

    // Create initial empty inventory for the camp
    const inventory = new Inventory({
      campId: camp._id,
      items: [],
      lastUpdatedBy: req.session.userId
    });
    await inventory.save();

    await camp.populate('createdBy', 'username');
    res.status(201).json(camp);
  } catch (error) {
    console.error('Error creating camp:', error);
    res.status(500).json({ error: 'Failed to create camp' });
  }
});

// Register camp official (Collector only)
router.post('/register-official', [requireAuth, requireRole(['Collector'])], [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('campId').notEmpty().withMessage('Camp ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, campId, phoneNumber } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Check if camp exists
    const camp = await Camp.findById(campId);
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create camp official
    const official = new User({
      username,
      email,
      password: hashedPassword,
      role: 'CampOfficial',
      phoneNumber,
      assignedCamp: campId
    });

    await official.save();

    // Add official to camp's assigned officials
    camp.assignedOfficials.push(official._id);
    await camp.save();

    res.status(201).json({ message: 'Camp official registered successfully' });
  } catch (error) {
    console.error('Error registering camp official:', error);
    res.status(500).json({ error: 'Failed to register camp official' });
  }
});

// Get camp details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const camp = await Camp.findById(req.params.id)
      .populate('assignedOfficials', 'username email phoneNumber')
      .populate('createdBy', 'username');
    
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }

    res.json(camp);
  } catch (error) {
    console.error('Error fetching camp details:', error);
    res.status(500).json({ error: 'Failed to fetch camp details' });
  }
});

module.exports = router;