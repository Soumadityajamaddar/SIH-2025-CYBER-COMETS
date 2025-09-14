const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

class OCRService {
  constructor() {
    this.tesseractWorker = null;
    this.isInitialized = false;
  }

  // Initialize Tesseract worker
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🔄 Initializing OCR service...');
      this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
          }
        }
      });

      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,!@#$%^&*()_+-=[]{}|;:\'\"<>?/~` ₹',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: '1'
      });

      this.isInitialized = true;
      console.log('✅ OCR service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OCR service:', error);
      throw new Error('OCR initialization failed');
    }
  }

  // Preprocess image for better OCR accuracy
  async preprocessImage(imagePath) {
    try {
      const processedPath = imagePath.replace(path.extname(imagePath), '_processed.png');
      
      await sharp(imagePath)
        .resize(2000, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .normalize()
        .sharpen()
        .threshold(128)
        .png()
        .toFile(processedPath);

      return processedPath;
    } catch (error) {
      console.error('Image preprocessing failed:', error);
      return imagePath; // Return original if preprocessing fails
    }
  }

  // Extract text from image using Tesseract.js
  async extractText(imagePath) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('📖 Starting OCR text extraction...');
      const startTime = Date.now();

      // Preprocess image
      const processedImagePath = await this.preprocessImage(imagePath);

      // Perform OCR
      const { data } = await this.tesseractWorker.recognize(processedImagePath);

      // Clean up processed image if different from original
      if (processedImagePath !== imagePath) {
        try {
          await fs.unlink(processedImagePath);
        } catch (e) {
          console.warn('Failed to cleanup processed image:', e.message);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ OCR completed in ${processingTime}ms`);

      return {
        text: this.cleanExtractedText(data.text),
        confidence: data.confidence,
        processingTime
      };

    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  // Clean and normalize extracted text
  cleanExtractedText(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s₹.,:-]/g, '') // Remove special characters except common ones
      .trim();
  }

  // Alternative OCR using Google Vision API (if configured)
  async extractTextGoogle(imagePath) {
    try {
      // Check if Google Cloud Vision is configured
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('Google Vision API not configured, using Tesseract.js');
        return this.extractText(imagePath);
      }

      const vision = require('@google-cloud/vision');
      const client = new vision.ImageAnnotatorClient();

      console.log('📖 Using Google Vision API for OCR...');
      const startTime = Date.now();

      // Read the image file
      const imageBuffer = await fs.readFile(imagePath);

      // Perform text detection
      const [result] = await client.textDetection({
        image: { content: imageBuffer }
      });

      const detections = result.textAnnotations;
      const processingTime = Date.now() - startTime;

      if (!detections || detections.length === 0) {
        throw new Error('No text detected in image');
      }

      console.log(`✅ Google Vision OCR completed in ${processingTime}ms`);

      return {
        text: this.cleanExtractedText(detections[0].description),
        confidence: 95, // Google Vision typically has high confidence
        processingTime
      };

    } catch (error) {
      console.error('Google Vision OCR failed, falling back to Tesseract:', error.message);
      return this.extractText(imagePath);
    }
  }

  // Get OCR statistics
  getStats() {
    return {
      isInitialized: this.isInitialized,
      service: 'Tesseract.js + Google Vision API (fallback)'
    };
  }

  // Cleanup resources
  async cleanup() {
    if (this.tesseractWorker) {
      try {
        await this.tesseractWorker.terminate();
        console.log('🧹 OCR worker terminated');
      } catch (error) {
        console.error('Failed to terminate OCR worker:', error);
      }
    }
  }

  // Mock OCR for development/demo purposes
  async mockExtractText(imagePath) {
    console.log('🎭 Using mock OCR data for demo...');
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const mockTexts = [
      `
        SUPER MARKET RECEIPT
        Date: ${new Date().toISOString().split('T')[0]}
        Bill No: SM-${Math.floor(Math.random() * 10000)}
        =====================================
        Rice Basmati 1kg         ₹85.00
        Cooking Oil 1L           ₹120.00
        Sugar White 1kg          ₹45.00
        Tea Leaves 250g          ₹75.00
        Milk Packet 500ml        ₹25.00
        =====================================
        Subtotal:                ₹350.00
        Tax (5%):                ₹17.50
        Total:                   ₹367.50
        =====================================
        Thank you for shopping!
      `,
      `
        GROCERY STORE
        ${new Date().toLocaleDateString()}
        Receipt #: GS${Math.floor(Math.random() * 1000)}
        ------------------------
        Bread                    ₹30.00
        Butter 100g              ₹45.00
        Eggs 12pcs               ₹60.00
        Onion 1kg                ₹25.00
        Potato 2kg               ₹40.00
        ------------------------
        Subtotal:                ₹200.00
        GST (12%):               ₹24.00
        Total Amount:            ₹224.00
        ------------------------
      `,
      `
        RETAIL MART BILL
        Date: ${new Date().toISOString().split('T')[0]}
        =====================================
        Shampoo 200ml            ₹95.00
        Soap Pack                ₹45.00
        Toothpaste               ₹55.00
        Detergent 1kg            ₹85.00
        =====================================
        Sub Total:               ₹280.00
        Tax (18%):               ₹50.40
        Final Total:             ₹330.40
        =====================================
      `
    ];

    const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];

    return {
      text: randomText.trim(),
      confidence: 85 + Math.random() * 10, // 85-95% confidence
      processingTime: 1500 + Math.random() * 1000
    };
  }
}

// Singleton instance
const ocrService = new OCRService();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down OCR service...');
  await ocrService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Terminating OCR service...');
  await ocrService.cleanup();
  process.exit(0);
});

module.exports = ocrService;