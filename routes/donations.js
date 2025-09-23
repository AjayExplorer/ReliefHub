const express = require('express');
const { body, validationResult } = require('express-validator');
const Donation = require('../models/Donation');
const Camp = require('../models/Camp');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all donations
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = {};
    
    // Filter by user role
    if (req.session.role === 'Donor') {
      query.donorId = req.session.userId;
    }

    const donations = await Donation.find(query)
      .populate('donorId', 'username email')
      .populate('campId', 'campName location')
      .sort({ createdAt: -1 });

    res.json(donations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

// Create donation (Donors only)
router.post('/', [requireAuth, requireRole(['Donor'])], [
  body('campId').notEmpty().withMessage('Camp ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('donationType').isIn(['Food', 'Medical', 'Clothing', 'Shelter', 'Other']).withMessage('Valid donation type is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { campId, items, donationType, message } = req.body;

    // Check if camp exists
    const camp = await Camp.findById(campId);
    if (!camp) {
      return res.status(404).json({ error: 'Camp not found' });
    }

    // Validate items
    for (const item of items) {
      if (!item.name || !item.quantity || !item.unit) {
        return res.status(400).json({ error: 'All items must have name, quantity, and unit' });
      }
    }

    const donation = new Donation({
      donorId: req.session.userId,
      campId,
      items,
      donationType,
      message
    });

    await donation.save();
    await donation.populate('campId', 'campName location');

    res.status(201).json(donation);
  } catch (error) {
    console.error('Error creating donation:', error);
    res.status(500).json({ error: 'Failed to create donation' });
  }
});

// Update donation status (Collector and Camp Official only)
router.put('/:id/status', [requireAuth, requireRole(['Collector', 'CampOfficial'])], [
  body('status').isIn(['Pending', 'In Transit', 'Delivered', 'Rejected']).withMessage('Valid status is required')
], async (req, res) => {
  try {
    const { status } = req.body;
    
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('donorId', 'username email')
     .populate('campId', 'campName location');

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    res.json(donation);
  } catch (error) {
    console.error('Error updating donation status:', error);
    res.status(500).json({ error: 'Failed to update donation status' });
  }
});

// Get donation by ID
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id)
            .populate('donorId', 'username email')
            .populate('campId', 'campName location');

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        res.json(donation);
    } catch (error) {
        console.error('Error fetching donation:', error);
        res.status(500).json({ error: 'Failed to fetch donation' });
    }
});

// Get donation by tracking ID
router.get('/track/:trackingId', async (req, res) => {
  try {
    const donation = await Donation.findOne({ trackingId: req.params.trackingId })
      .populate('campId', 'campName location');

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    res.json(donation);
  } catch (error) {
    console.error('Error tracking donation:', error);
    res.status(500).json({ error: 'Failed to track donation' });
  }
});

module.exports = router;