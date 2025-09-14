const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('📁 Created uploads directory');
}

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `bill_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Mock OCR function for reading bills
const mockOCRProcess = async (imagePath) => {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
  
  // Generate realistic bill data
  const mockBills = [
    {
      storeName: "Super Market",
      date: "2024-01-15",
      billNumber: "SM001234",
      items: [
        { name: "Rice Basmati 1kg", quantity: 1, unitPrice: 85.00, price: 85.00 },
        { name: "Cooking Oil 1L", quantity: 1, unitPrice: 120.00, price: 120.00 },
        { name: "Sugar White 1kg", quantity: 1, unitPrice: 45.00, price: 45.00 },
        { name: "Tea Leaves 250g", quantity: 1, unitPrice: 75.00, price: 75.00 }
      ],
      subtotal: 325.00,
      tax: 16.25,
      taxRate: 5,
      discount: 0,
      total: 341.25
    },
    {
      storeName: "Grocery Store",
      date: "2024-01-16",
      billNumber: "GS005678",
      items: [
        { name: "Bread Whole Wheat", quantity: 2, unitPrice: 25.00, price: 50.00 },
        { name: "Milk 1L", quantity: 1, unitPrice: 55.00, price: 55.00 },
        { name: "Eggs 12pcs", quantity: 1, unitPrice: 84.00, price: 84.00 },
        { name: "Banana 1kg", quantity: 1, unitPrice: 60.00, price: 60.00 }
      ],
      subtotal: 249.00,
      tax: 29.88,
      taxRate: 12,
      discount: 0,
      total: 278.88
    },
    {
      storeName: "Fresh Mart",
      date: "2024-01-17",
      billNumber: "FM009876",
      items: [
        { name: "Chicken 1kg", quantity: 1, unitPrice: 180.00, price: 180.00 },
        { name: "Onion 2kg", quantity: 2, unitPrice: 25.00, price: 50.00 },
        { name: "Tomato 1kg", quantity: 1, unitPrice: 40.00, price: 40.00 },
        { name: "Potato 2kg", quantity: 2, unitPrice: 20.00, price: 40.00 }
      ],
      subtotal: 310.00,
      tax: 15.50,
      taxRate: 5,
      discount: 10.00,
      total: 315.50
    }
  ];
  
  return mockBills[Math.floor(Math.random() * mockBills.length)];
};

// Validation algorithms
const validateBill = (billData) => {
  const errors = [];
  const warnings = [];
  
  // Algorithm 1: Math Verification
  const calculatedSubtotal = billData.items.reduce((sum, item) => sum + item.price, 0);
  if (Math.abs(calculatedSubtotal - billData.subtotal) > 0.01) {
    errors.push({
      type: 'MATH_ERROR',
      message: `Subtotal mismatch: Calculated ₹${calculatedSubtotal.toFixed(2)} vs Printed ₹${billData.subtotal.toFixed(2)}`,
      severity: 'high'
    });
  }
  
  // Algorithm 2: Tax Validation
  const expectedTax = (billData.subtotal * billData.taxRate) / 100;
  if (Math.abs(expectedTax - billData.tax) > 0.01) {
    errors.push({
      type: 'TAX_ERROR',
      message: `Tax calculation error: Expected ₹${expectedTax.toFixed(2)} vs Printed ₹${billData.tax.toFixed(2)}`,
      severity: 'medium'
    });
  }
  
  // Algorithm 3: Total Check
  const expectedTotal = billData.subtotal + billData.tax - billData.discount;
  if (Math.abs(expectedTotal - billData.total) > 0.01) {
    errors.push({
      type: 'TOTAL_ERROR',
      message: `Total calculation error: Expected ₹${expectedTotal.toFixed(2)} vs Printed ₹${billData.total.toFixed(2)}`,
      severity: 'high'
    });
  }
  
  // Algorithm 4: Date Logic
  const billDate = new Date(billData.date);
  const today = new Date();
  const daysDiff = (today - billDate) / (1000 * 60 * 60 * 24);
  
  if (daysDiff < -1) {
    warnings.push({
      type: 'FUTURE_DATE',
      message: 'Bill date is in the future',
      severity: 'low'
    });
  }
  
  // Algorithm 5: Pattern Analysis
  const itemNames = billData.items.map(item => item.name.toLowerCase());
  const duplicates = itemNames.filter((name, index) => itemNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    warnings.push({
      type: 'DUPLICATE_ITEMS',
      message: `Potential duplicate items: ${[...new Set(duplicates)].join(', ')}`,
      severity: 'medium'
    });
  }
  
  // Calculate confidence score
  const confidenceScore = Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5));
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidenceScore,
    algorithmResults: {
      mathVerification: errors.filter(e => e.type === 'MATH_ERROR').length === 0,
      taxValidation: errors.filter(e => e.type === 'TAX_ERROR').length === 0,
      totalCheck: errors.filter(e => e.type === 'TOTAL_ERROR').length === 0,
      dateValidation: warnings.filter(w => w.type === 'FUTURE_DATE').length === 0,
      patternAnalysis: true
    }
  };
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Smart Bill Verifier API',
    team: 'Cyber Comets',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Smart Bill Verifier API',
    description: 'OCR-Powered Bill Verification System by Cyber Comets',
    version: '1.0.0',
    hackathon: 'Smart India Hackathon 2025',
    problemStatementId: '25132',
    theme: 'Student Innovation',
    team: 'Cyber Comets',
    status: 'Running Successfully! 🚀'
  });
});

// Process bill endpoint
app.post('/api/bills/process', upload.single('billImage'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded',
        code: 'NO_FILE'
      });
    }

    console.log(`📤 Processing bill: ${req.file.originalname} (${req.file.size} bytes)`);

    // Step 1: Mock OCR Processing (simulates reading the actual bill)
    console.log('🔄 Starting OCR processing...');
    const billData = await mockOCRProcess(req.file.path);
    console.log(`✅ OCR completed: Found ${billData.items.length} items, total ₹${billData.total}`);

    // Step 2: Validate the bill
    console.log('🔄 Running validation algorithms...');
    const validation = validateBill(billData);
    console.log(`✅ Validation completed: ${validation.isValid ? 'VALID' : 'INVALID'} (${validation.confidenceScore}%)`);

    const processingTime = Date.now() - startTime;

    // Step 3: Generate response
    const response = {
      success: true,
      data: {
        id: Date.now().toString(),
        fileName: req.file.originalname,
        fileSize: formatFileSize(req.file.size),
        processingTime: `${processingTime}ms`,
        
        ocr: {
          confidence: 85 + Math.random() * 10,
          textLength: 450 + Math.random() * 200,
          processingTime: `${processingTime * 0.6}ms`
        },
        
        billData: billData,
        validation: validation,
        
        processedAt: new Date().toISOString(),
        team: 'Cyber Comets'
      },
      
      metadata: {
        mode: 'mock_processing_with_real_validation',
        algorithms: ['math_verification', 'tax_validation', 'total_check', 'date_logic', 'pattern_analysis'],
        processingStages: {
          ocr: 'completed',
          parsing: 'completed', 
          validation: 'completed'
        }
      }
    };

    console.log('🎉 Bill processing completed successfully!');
    res.json(response);

    // Clean up file after processing
    setTimeout(() => {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.warn('Failed to cleanup file:', err.message);
      }
    }, 1000);

  } catch (error) {
    console.error('❌ Bill processing failed:', error);
    
    // Clean up file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      code: 'PROCESSING_FAILED',
      suggestions: [
        'Ensure the image is clear and well-lit',
        'Make sure the bill/receipt is fully visible',
        'Try with a JPG or PNG image format'
      ]
    });
  }
});

// Get bill history
app.get('/api/bills/history/:userId?', (req, res) => {
  // Mock history data
  const mockHistory = [];
  for (let i = 0; i < 5; i++) {
    mockHistory.push({
      id: (Date.now() - i * 86400000).toString(),
      fileName: `bill_${i + 1}.jpg`,
      fileSize: `${(1.5 + Math.random() * 3).toFixed(1)} MB`,
      isValid: Math.random() > 0.3,
      confidenceScore: Math.floor(70 + Math.random() * 30),
      processingStage: 'completed',
      processingTime: `${(1.5 + Math.random() * 2).toFixed(1)}s`,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      status: 'completed'
    });
  }

  res.json({
    success: true,
    data: {
      bills: mockHistory,
      pagination: {
        total: mockHistory.length,
        limit: 10,
        offset: 0,
        hasMore: false
      }
    }
  });
});

// API Documentation
app.get('/api/bills/docs', (req, res) => {
  res.json({
    success: true,
    documentation: {
      title: 'Smart Bill Verifier API',
      version: '1.0.0',
      description: 'OCR-powered bill verification API for Smart India Hackathon 2025',
      team: 'Cyber Comets',
      problemStatement: '25132',
      endpoints: [
        {
          method: 'POST',
          path: '/api/bills/process',
          description: 'Process and verify bill image',
          parameters: {
            billImage: 'File (required) - Image file (JPEG, PNG, GIF)',
            userId: 'String (optional) - User identifier'
          }
        },
        {
          method: 'GET', 
          path: '/api/bills/history/:userId?',
          description: 'Get bill processing history'
        }
      ],
      features: [
        '📖 OCR Text Extraction',
        '🧮 Mathematical Verification',
        '💰 Tax Calculation Validation', 
        '✅ Total Amount Verification',
        '📅 Date Logic Validation',
        '🔍 Pattern Analysis'
      ]
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File size too large (max 5MB)',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Helper function
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 Smart Bill Verifier API Server Started');
  console.log('================================================');
  console.log(`🌐 Server running on: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/api/bills/docs`);
  console.log(`👥 Team: Cyber Comets`);
  console.log(`🎯 Smart India Hackathon 2025 - Problem ID: 25132`);
  console.log('================================================\n');
});

module.exports = app;