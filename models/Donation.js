const mongoose = require('mongoose');

const donationItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    required: true,
    trim: true
  }
});

const donationSchema = new mongoose.Schema({
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  campId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  items: [donationItemSchema],
  status: {
    type: String,
    enum: ['Pending', 'In Transit', 'Delivered', 'Rejected'],
    default: 'Pending'
  },
  donationType: {
    type: String,
    enum: ['Food', 'Medical', 'Clothing', 'Shelter', 'Other'],
    required: true
  },
  message: {
    type: String,
    trim: true
  },
  trackingId: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Generate tracking ID before saving
donationSchema.pre('save', function(next) {
  if (!this.trackingId) {
    this.trackingId = 'RH' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('Donation', donationSchema);