const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    required: true,
    enum: ['Collector', 'CampOfficial', 'Donor'],
    default: 'Donor'
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  assignedCamp: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);