const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Food', 'Medical', 'Clothing', 'Shelter', 'Other']
  },
  minThreshold: {
    type: Number,
    default: 10
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const inventorySchema = new mongoose.Schema({
  campId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true,
    unique: true
  },
  items: [inventoryItemSchema],
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Inventory', inventorySchema);