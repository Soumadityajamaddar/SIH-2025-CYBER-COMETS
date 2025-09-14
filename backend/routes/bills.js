const express = require('express');
const rateLimit = require('express-rate-limit');
const { billController, upload, uploadMultiple } = require('../controllers/billController');

const router = express.Router();

// Rate limiting middleware
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 uploads per 5 minutes
  message: {
    success: false,
    error: 'Upload limit exceeded, please try again later',
    code: 'UPLOAD_LIMIT_EXCEEDED'
  }
});

// Input validation middleware
const validateProcessRequest = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      error: 'No image file uploaded',
      code: 'NO_FILE_UPLOADED'
    });
  }
  
  // Validate userId if provided
  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid userId format',
      code: 'INVALID_USER_ID'
    });
  }
  
  next();
};

const validateHistoryRequest = (req, res, next) => {
  const { limit, offset } = req.query;
  
  if (limit && (isNaN(limit) || parseInt(limit) > 100)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid limit parameter (max 100)',
      code: 'INVALID_LIMIT'
    });
  }
  
  if (offset && isNaN(offset)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid offset parameter',
      code: 'INVALID_OFFSET'
    });
  }
  
  next();
};

const validateBillId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid bill ID format',
      code: 'INVALID_BILL_ID'
    });
  }
  
  next();
};

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error) {
    if (error instanceof multer.MulterError) {
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({
            success: false,
            error: 'File size too large (max 5MB)',
            code: 'FILE_TOO_LARGE'
          });
        case 'LIMIT_FILE_COUNT':
          return res.status(400).json({
            success: false,
            error: 'Too many files uploaded',
            code: 'TOO_MANY_FILES'
          });
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({
            success: false,
            error: 'Unexpected field name for file upload',
            code: 'UNEXPECTED_FIELD'
          });
        default:
          return res.status(400).json({
            success: false,
            error: 'File upload error',
            code: 'UPLOAD_ERROR'
          });
      }
    }
    
    return res.status(400).json