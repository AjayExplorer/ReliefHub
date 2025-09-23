const express = require('express');
const { body, validationResult } = require('express-validator');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get inventory for a camp
router.get('/:campId', requireAuth, async (req, res) => {
  try {
    const inventory = await Inventory.findOne({ campId: req.params.campId })
      .populate('campId', 'campName location')
      .populate('lastUpdatedBy', 'username');

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Update inventory (Camp Officials only)
router.put('/:campId', [requireAuth, requireRole(['CampOfficial'])], [
  body('items').isArray().withMessage('Items must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is assigned to this camp
    const user = await User.findById(req.session.userId);
    if (user.assignedCamp.toString() !== req.params.campId) {
      return res.status(403).json({ error: 'Not authorized to update this inventory' });
    }

    const { items } = req.body;

    // Validate items
    for (const item of items) {
      if (!item.name || item.quantity === undefined || !item.unit || !item.category) {
        return res.status(400).json({ error: 'All items must have name, quantity, unit, and category' });
      }
    }

    const inventory = await Inventory.findOneAndUpdate(
      { campId: req.params.campId },
      { 
        items: items.map(item => ({
          ...item,
          lastUpdated: new Date()
        })),
        lastUpdatedBy: req.session.userId
      },
      { new: true, upsert: true }
    ).populate('campId', 'campName location')
     .populate('lastUpdatedBy', 'username');

    res.json(inventory);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// Get low stock items across all camps
router.get('/alerts/low-stock', [requireAuth, requireRole(['Collector'])], async (req, res) => {
  try {
    const inventories = await Inventory.find()
      .populate('campId', 'campName location');

    const lowStockItems = [];

    inventories.forEach(inventory => {
      inventory.items.forEach(item => {
        if (item.quantity <= item.minThreshold) {
          lowStockItems.push({
            campName: inventory.campId.campName,
            campLocation: inventory.campId.location,
            itemName: item.name,
            currentQuantity: item.quantity,
            minThreshold: item.minThreshold,
            unit: item.unit,
            category: item.category
          });
        }
      });
    });

    res.json(lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock alerts:', error);
    res.status(500).json({ error: 'Failed to fetch low stock alerts' });
  }
});

module.exports = router;