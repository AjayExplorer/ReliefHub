const mongoose = require('mongoose');

const campSchema = new mongoose.Schema({
  campName: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  strength: {
    type: Number,
    required: true,
    min: 1
  },
  assignedOfficials: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Camp', campSchema);