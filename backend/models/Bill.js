const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
  // File Information
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  
  // OCR Data
  ocrText: {
    type: String,
    required: true
  },
  ocrConfidence: {
    type: Number,
    default: 0
  },
  
  // Parsed Bill Data
  billData: {
    date: {
      type: String,
      default: ''
    },
    storeName: {
      type: String,
      default: ''
    },
    storeAddress: {
      type: String,
      default: ''
    },
    billNumber: {
      type: String,
      default: ''
    },
    items: [{
      name: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        default: 1
      },
      unitPrice: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      }
    }],
    subtotal: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    taxRate: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: '₹'
    }
  },
  
  // Validation Results
  validation: {
    isValid: {
      type: Boolean,
      default: false
    },
    errors: [{
      type: {
        type: String,
        enum: ['MATH_ERROR', 'TAX_ERROR', 'TOTAL_ERROR', 'DATE_ERROR', 'PRICE_ERROR']
      },
      message: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      },
      field: String,
      expected: mongoose.Schema.Types.Mixed,
      actual: mongoose.Schema.Types.Mixed
    }],
    warnings: [{
      type: {
        type: String,
        enum: ['FUTURE_DATE', 'OLD_DATE', 'DUPLICATE_ITEMS', 'PRICE_OUTLIER', 'SUSPICIOUS_PATTERN']
      },
      message: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
      },
      field: String
    }],
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    algorithmResults: {
      mathVerification: Boolean,
      taxValidation: Boolean,
      totalCheck: Boolean,
      dateValidation: Boolean,
      patternAnalysis: Boolean
    }
  },
  
  // Processing Information
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  processingStage: {
    type: String,
    enum: ['uploaded', 'ocr_processing', 'parsing', 'validating', 'completed', 'failed'],
    default: 'uploaded'
  },
  
  // User Information (for future user management)
  userId: {
    type: String,
    default: 'anonymous'
  },
  sessionId: String,
  ipAddress: String,
  userAgent: String,
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  
  // Analytics
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloaded: Date,
  
  // Status
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
BillSchema.index({ userId: 1, createdAt: -1 });
BillSchema.index({ processingStage: 1 });
BillSchema.index({ 'validation.isValid': 1 });
BillSchema.index({ createdAt: -1 });

// Virtual for formatted file size
BillSchema.virtual('formattedFileSize').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for processing duration
BillSchema.virtual('processingDuration').get(function() {
  if (this.processingTime < 1000) return `${this.processingTime}ms`;
  return `${(this.processingTime / 1000).toFixed(2)}s`;
});

// Pre-save middleware
BillSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods
BillSchema.statics.getStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalBills: { $sum: 1 },
        validBills: { $sum: { $cond: ['$validation.isValid', 1, 0] } },
        averageConfidence: { $avg: '$validation.confidenceScore' },
        averageProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);
};

BillSchema.statics.getRecentActivity = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('fileName validation.isValid validation.confidenceScore createdAt processingTime');
};

module.exports = mongoose.model('Bill', BillSchema);