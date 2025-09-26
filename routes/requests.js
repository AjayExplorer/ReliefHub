const express = require('express');
const { body, validationResult } = require('express-validator');
const Request = require('../models/Request');
const Camp = require('../models/Camp');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get urgent requests
router.get('/urgent', requireAuth, async (req, res) => {
  try {
    const urgentRequests = await Request.find({
      status: 'Approved',
      urgency: { $in: ['High', 'Critical'] }
    })
    .populate('campId', 'campName location')
    .sort({ createdAt: -1 })
    .limit(10);

    const formattedRequests = urgentRequests.map(request => ({
      _id: request._id,
      itemName: request.items[0].name,
      quantity: request.items[0].quantity,
      unit: request.items[0].unit,
      campId: request.campId._id,
      campName: request.campId.campName,
      urgency: request.urgency
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error('Error fetching urgent requests:', error);
    res.status(500).json({ error: 'Failed to fetch urgent requests' });
  }
});

// Get all requests
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = {};
    
    // Filter by user role and assigned camp
    if (req.session.role === 'CampOfficial') {
      const user = await User.findById(req.session.userId);
      if (user.assignedCamp) {
        query.campId = user.assignedCamp;
      }
    }

    const requests = await Request.find(query)
      .populate('raisedBy', 'username role')
      .populate('campId', 'campName location')
      .populate('approvedBy', 'username')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Create request (Camp Officials only)
router.post('/', [requireAuth, requireRole(['CampOfficial'])], [
  body('title').notEmpty().withMessage('Title is required'),
  body('type').isIn(['Food', 'Medical', 'Clothing', 'Shelter', 'Other']).withMessage('Valid type is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('urgency').isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Valid urgency level is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get user's assigned camp
    const user = await User.findById(req.session.userId);
    if (!user.assignedCamp) {
      return res.status(400).json({ error: 'No camp assigned to this official' });
    }

    const { title, type, items, urgency, description } = req.body;

    // Validate items
    for (const item of items) {
      if (!item.name || !item.quantity || !item.unit) {
        return res.status(400).json({ error: 'All items must have name, quantity, and unit' });
      }
    }

    const request = new Request({
      title,
      type,
      items,
      raisedBy: req.session.userId,
      campId: user.assignedCamp,
      urgency,
      description
    });

    await request.save();
    await request.populate('campId', 'campName location');
    await request.populate('raisedBy', 'username');

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Get single request by ID (for donors to prefill donation form)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('campId', 'campName location');

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Return a simplified shape that the frontend expects
    const firstItem = request.items && request.items.length > 0 ? request.items[0] : null;
    const response = firstItem ? {
      _id: request._id,
      itemName: firstItem.name,
      quantity: firstItem.quantity,
      unit: firstItem.unit,
      campId: request.campId._id,
      campName: request.campId.campName,
      type: request.type,
      urgency: request.urgency
    } : {
      _id: request._id,
      campId: request.campId._id,
      campName: request.campId.campName,
      type: request.type,
      urgency: request.urgency,
      items: request.items
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// Update request status (Collector only)
router.put('/:id/status', [requireAuth, requireRole(['Collector'])], [
  body('status').isIn(['Pending', 'Approved', 'Fulfilled', 'Rejected']).withMessage('Valid status is required')
], async (req, res) => {
  try {
    const { status } = req.body;
    
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        approvedBy: req.session.userId
      },
      { new: true }
    ).populate('raisedBy', 'username')
     .populate('campId', 'campName location')
     .populate('approvedBy', 'username');

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ error: 'Failed to update request status' });
  }
});

module.exports = router;