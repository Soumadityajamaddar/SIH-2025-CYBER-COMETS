class ValidationService {
  constructor() {
    this.indianTaxRates = [0, 5, 12, 18, 28]; // Common GST rates in India
    this.maxReasonablePrice = 10000; // Maximum reasonable price for a single item
    this.maxBillAge = 365; // Maximum reasonable bill age in days
  }

  // Main validation function
  validateBill(billData) {
    console.log('🔍 Starting bill validation...');
    const startTime = Date.now();

    try {
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        confidenceScore: 100,
        algorithmResults: {
          mathVerification: false,
          taxValidation: false,
          totalCheck: false,
          dateValidation: false,
          patternAnalysis: false
        }
      };

      // Run all validation algorithms
      this.validateMathematicalAccuracy(billData, validation);
      this.validateTaxCalculations(billData, validation);
      this.validateTotalAmount(billData, validation);
      this.validateDateLogic(billData, validation);
      this.analyzePatterns(billData, validation);
      this.validateBusinessLogic(billData, validation);
      this.detectAnomalies(billData, validation);

      // Calculate final validation status
      validation.isValid = validation.errors.length === 0;
      validation.confidenceScore = this.calculateConfidenceScore(validation);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Bill validation completed in ${processingTime}ms`);

      return validation;

    } catch (error) {
      console.error('❌ Validation failed:', error);
      return {
        isValid: false,
        errors: [{ type: 'VALIDATION_ERROR', message: error.message, severity: 'high' }],
        warnings: [],
        confidenceScore: 0,
        algorithmResults: {}
      };
    }
  }

  // Algorithm 1: Mathematical Accuracy Verification
  validateMathematicalAccuracy(billData, validation) {
    try {
      const calculatedSubtotal = billData.items.reduce((sum, item) => sum + item.price, 0);
      const tolerance = 0.01; // 1 paisa tolerance

      if (Math.abs(calculatedSubtotal - billData.subtotal) > tolerance) {
        validation.errors.push({
          type: 'MATH_ERROR',
          message: `Subtotal mismatch: Calculated ₹${calculatedSubtotal.toFixed(2)} vs Printed ₹${billData.subtotal.toFixed(2)}`,
          severity: 'high',
          field: 'subtotal',
          expected: calculatedSubtotal,
          actual: billData.subtotal
        });
      } else {
        validation.algorithmResults.mathVerification = true;
      }

      // Validate individual item calculations
      billData.items.forEach((item, index) => {
        const calculatedPrice = item.quantity * item.unitPrice;
        if (Math.abs(calculatedPrice - item.price) > tolerance) {
          validation.errors.push({
            type: 'MATH_ERROR',
            message: `Item ${index + 1} price mismatch: ${item.quantity} × ₹${item.unitPrice} = ₹${calculatedPrice.toFixed(2)} vs ₹${item.price.toFixed(2)}`,
            severity: 'medium',
            field: `items[${index}].price`,
            expected: calculatedPrice,
            actual: item.price
          });
        }
      });

    } catch (error) {
      console.error('Math verification failed:', error);
      validation.warnings.push({
        type: 'MATH_ERROR',
        message: 'Unable to verify mathematical accuracy',
        severity: 'medium'
      });
    }
  }

  // Algorithm 2: Tax Calculation Validation
  validateTaxCalculations(billData, validation) {
    try {
      if (billData.tax === 0) {
        validation.warnings.push({
          type: 'TAX_ERROR',
          message: 'No tax found on bill - this may be unusual for retail purchases',
          severity: 'low'
        });
        validation.algorithmResults.taxValidation = true;
        return;
      }

      // Check if tax rate is reasonable
      const actualTaxRate = (billData.tax / billData.subtotal) * 100;
      const closestValidRate = this.findClosestTaxRate(actualTaxRate);
      const rateTolerance = 0.5; // 0.5% tolerance

      if (Math.abs(actualTaxRate - closestValidRate) > rateTolerance) {
        validation.errors.push({
          type: 'TAX_ERROR',
          message: `Invalid tax rate: ${actualTaxRate.toFixed(2)}% (closest valid rate: ${closestValidRate}%)`,
          severity: 'medium',
          field: 'tax',
          expected: (billData.subtotal * closestValidRate / 100).toFixed(2),
          actual: billData.tax
        });
      } else {
        validation.algorithmResults.taxValidation = true;
      }

      // Validate tax amount calculation
      const expectedTax = (billData.subtotal * closestValidRate) / 100;
      if (Math.abs(expectedTax - billData.tax) > 0.01) {
        validation.errors.push({
          type: 'TAX_ERROR',
          message: `Tax calculation error: Expected ₹${expectedTax.toFixed(2)} (${closestValidRate}%) vs Printed ₹${billData.tax.toFixed(2)}`,
          severity: 'medium',
          field: 'tax',
          expected: expectedTax,
          actual: billData.tax
        });
      }

    } catch (error) {
      console.error('Tax validation failed:', error);
      validation.warnings.push({
        type: 'TAX_ERROR',
        message: 'Unable to validate tax calculations',
        severity: 'medium'
      });
    }
  }

  // Algorithm 3: Total Amount Verification
  validateTotalAmount(billData, validation) {
    try {
      const calculatedTotal = billData.subtotal + billData.tax - billData.discount;
      const tolerance = 0.01;

      if (Math.abs(calculatedTotal - billData.total) > tolerance) {
        validation.errors.push({
          type: 'TOTAL_ERROR',
          message: `Total calculation error: Expected ₹${calculatedTotal.toFixed(2)} vs Printed ₹${billData.total.toFixed(2)}`,
          severity: 'high',
          field: 'total',
          expected: calculatedTotal,
          actual: billData.total
        });
      } else {
        validation.algorithmResults.totalCheck = true;
      }

      // Check for negative total
      if (billData.total < 0) {
        validation.errors.push({
          type: 'TOTAL_ERROR',
          message: 'Total amount cannot be negative',
          severity: 'high',
          field: 'total'
        });
      }

      // Check for unreasonably high total
      if (billData.total > 100000) { // ₹1 lakh
        validation.warnings.push({
          type: 'TOTAL_ERROR',
          message: `Very high total amount: ₹${billData.total.toFixed(2)}`,
          severity: 'low',
          field: 'total'
        });
      }

    } catch (error) {
      console.error('Total validation failed:', error);
      validation.warnings.push({
        type: 'TOTAL_ERROR',
        message: 'Unable to validate total amount',
        severity: 'medium'
      });
    }
  }

  // Algorithm 4: Date Logic Validation
  validateDateLogic(billData, validation) {
    try {
      if (!billData.date) {
        validation.warnings.push({
          type: 'DATE_ERROR',
          message: 'No date found on bill',
          severity: 'low',
          field: 'date'
        });
        validation.algorithmResults.dateValidation = true;
        return;
      }

      const billDate = new Date(billData.date);
      const currentDate = new Date();
      const daysDifference = (currentDate - billDate) / (1000 * 60 * 60 * 24);

      // Check for future dates
      if (daysDifference < -1) {
        validation.errors.push({
          type: 'DATE_ERROR',
          message: 'Bill date is in the future',
          severity: 'high',
          field: 'date',
          actual: billData.date
        });
      }

      // Check for very old bills
      else if (daysDifference > this.maxBillAge) {
        validation.warnings.push({
          type: 'OLD_DATE',
          message: `Bill is very old (${Math.floor(daysDifference)} days)`,
          severity: 'low',
          field: 'date'
        });
      }

      // Check for weekend/holiday patterns (for business bills)
      const billDayOfWeek = billDate.getDay();
      if (billDayOfWeek === 0 && billData.total > 1000) { // Sunday with high amount
        validation.warnings.push({
          type: 'DATE_ERROR',
          message: 'High-value transaction on Sunday - verify if store was open',
          severity: 'low'
        });
      }

      validation.algorithmResults.dateValidation = true;

    } catch (error) {
      console.error('Date validation failed:', error);
      validation.warnings.push({
        type: 'DATE_ERROR',
        message: 'Unable to validate date',
        severity: 'low'
      });
    }
  }

  // Algorithm 5: Pattern Analysis
  analyzePatterns(billData, validation) {
    try {
      this.detectDuplicateItems(billData, validation);
      this.detectPriceOutliers(billData, validation);
      this.analyzeQuantityPatterns(billData, validation);
      this.detectSuspiciousRounding(billData, validation);

      validation.algorithmResults.patternAnalysis = true;

    } catch (error) {
      console.error('Pattern analysis failed:', error);
      validation.warnings.push({
        type: 'SUSPICIOUS_PATTERN',
        message: 'Unable to complete pattern analysis',
        severity: 'low'
      });
    }
  }

  // Detect duplicate items
  detectDuplicateItems(billData, validation) {
    const itemNames = billData.items.map(item => item.name.toLowerCase().trim());
    const duplicates = itemNames.filter((name, index) => itemNames.indexOf(name) !== index);

    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      validation.warnings.push({
        type: 'DUPLICATE_ITEMS',
        message: `Potential duplicate items: ${uniqueDuplicates.join(', ')}`,
        severity: 'medium',
        field: 'items'
      });
    }
  }

  // Detect price outliers
  detectPriceOutliers(billData, validation) {
    if (billData.items.length < 3) return; // Need at least 3 items for outlier detection

    const prices = billData.items.map(item => item.price);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const stdDev = Math.sqrt(prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length);

    const outliers = billData.items.filter(item => {
      const zScore = Math.abs(item.price - mean) / stdDev;
      return zScore > 2 && item.price > this.maxReasonablePrice; // Z-score > 2 and price > reasonable limit
    });

    if (outliers.length > 0) {
      validation.warnings.push({
        type: 'PRICE_OUTLIER',
        message: `Unusually high prices detected: ${outliers.map(item => `${item.name} (₹${item.price})`).join(', ')}`,
        severity: 'low',
        field: 'items'
      });
    }
  }

  // Analyze quantity patterns
  analyzeQuantityPatterns(billData, validation) {
    const unusualQuantities = billData.items.filter(item => item.quantity > 100 || item.quantity <= 0);

    if (unusualQuantities.length > 0) {
      validation.warnings.push({
        type: 'SUSPICIOUS_PATTERN',
        message: `Unusual quantities detected: ${unusualQuantities.map(item => `${item.name} (qty: ${item.quantity})`).join(', ')}`,
        severity: 'low',
        field: 'items'
      });
    }
  }

  // Detect suspicious rounding
  detectSuspiciousRounding(billData, validation) {
    // Check if all prices end in .00 (might indicate manual rounding)
    const roundPrices = billData.items.filter(item => item.price % 1 === 0).length;
    const totalItems = billData.items.length;

    if (roundPrices === totalItems && totalItems > 3) {
      validation.warnings.push({
        type: 'SUSPICIOUS_PATTERN',
        message: 'All item prices are round numbers - verify pricing accuracy',
        severity: 'low'
      });
    }

    // Check for total that's suspiciously round
    if (billData.total % 10 === 0 && billData.total > 100) {
      validation.warnings.push({
        type: 'SUSPICIOUS_PATTERN',
        message: 'Total amount is a round number - verify calculation',
        severity: 'low'
      });
    }
  }

  // Business logic validation
  validateBusinessLogic(billData, validation) {
    // Check minimum transaction amount
    if (billData.total < 1) {
      validation.errors.push({
        type: 'TOTAL_ERROR',
        message: 'Total amount too small for a valid transaction',
        severity: 'high'
      });
    }

    // Check if items make sense together
    this.validateItemCombinations(billData, validation);

    // Check pricing consistency
    this.validatePricingConsistency(billData, validation);
  }

  // Validate item combinations
  validateItemCombinations(billData, validation) {
    const itemCategories = this.categorizeItems(billData.items);
    
    // Example: If buying baby formula and alcohol together (unusual combination)
    if (itemCategories.includes('baby') && itemCategories.includes('alcohol')) {
      validation.warnings.push({
        type: 'SUSPICIOUS_PATTERN',
        message: 'Unusual item combination detected',
        severity: 'low'
      });
    }
  }

  // Validate pricing consistency
  validatePricingConsistency(billData, validation) {
    const itemNames = billData.items.map(item => item.name.toLowerCase());
    const duplicateItems = {};

    // Group duplicate items
    billData.items.forEach(item => {
      const key = item.name.toLowerCase();
      if (!duplicateItems[key]) {
        duplicateItems[key] = [];
      }
      duplicateItems[key].push(item);
    });

    // Check if same items have different unit prices
    Object.entries(duplicateItems).forEach(([name, items]) => {
      if (items.length > 1) {
        const prices = items.map(item => item.unitPrice);
        const uniquePrices = [...new Set(prices)];
        
        if (uniquePrices.length > 1) {
          validation.warnings.push({
            type: 'PRICE_OUTLIER',
            message: `Same item "${name}" has different unit prices: ${uniquePrices.map(p => `₹${p}`).join(', ')}`,
            severity: 'medium'
          });
        }
      }
    });
  }

  // Detect anomalies using statistical methods
  detectAnomalies(billData, validation) {
    try {
      // Check for Benford's Law violations (for large datasets)
      this.checkBenfordsLaw(billData, validation);
      
      // Check for timing anomalies
      this.checkTimingAnomalies(billData, validation);
      
    } catch (error) {
      console.warn('Anomaly detection failed:', error.message);
    }
  }

  // Check Benford's Law for first digit distribution
  checkBenfordsLaw(billData, validation) {
    if (billData.items.length < 10) return; // Need sufficient data

    const firstDigits = billData.items
      .map(item => item.price.toString().charAt(0))
      .filter(digit => digit !== '0');

    const digitCounts = {};
    firstDigits.forEach(digit => {
      digitCounts[digit] = (digitCounts[digit] || 0) + 1;
    });

    // Check if distribution significantly violates Benford's Law
    // (This is a simplified check - full implementation would be more complex)
    const mostCommonDigit = Object.keys(digitCounts).reduce((a, b) => 
      digitCounts[a] > digitCounts[b] ? a : b
    );

    if (mostCommonDigit !== '1' && firstDigits.length > 20) {
      validation.warnings.push({
        type: 'SUSPICIOUS_PATTERN',
        message: 'Price distribution may indicate artificial data',
        severity: 'low'
      });
    }
  }

  // Check for timing anomalies
  checkTimingAnomalies(billData, validation) {
    if (!billData.date) return;

    const billDate = new Date(billData.date);
    const hour = billDate.getHours();

    // Check for unusual business hours
    if (hour < 6 || hour > 23) {
      validation.warnings.push({
        type: 'DATE_ERROR',
        message: `Transaction at unusual hour: ${hour}:00`,
        severity: 'low'
      });
    }
  }

  // Helper methods
  findClosestTaxRate(actualRate) {
    return this.indianTaxRates.reduce((closest, rate) => {
      return Math.abs(rate - actualRate) < Math.abs(closest - actualRate) ? rate : closest;
    });
  }

  categorizeItems(items) {
    const categories = [];
    const categoryKeywords = {
      food: ['rice', 'bread', 'milk', 'egg', 'chicken', 'vegetable', 'fruit'],
      alcohol: ['beer', 'wine', 'whisky', 'vodka', 'rum'],
      baby: ['diaper', 'formula', 'baby', 'infant'],
      medical: ['medicine', 'tablet', 'syrup', 'bandage']
    };

    items.forEach(item => {
      const itemName = item.name.toLowerCase();
      Object.entries(categoryKeywords).forEach(([category, keywords]) => {
        if (keywords.some(keyword => itemName.includes(keyword))) {
          if (!categories.includes(category)) {
            categories.push(category);
          }
        }
      });
    });

    return categories;
  }

  calculateConfidenceScore(validation) {
    let score = 100;

    // Deduct points for errors
    validation.errors.forEach(error => {
      switch (error.severity) {
        case 'high':
          score -= 25;
          break;
        case 'medium':
          score -= 15;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });

    // Deduct points for warnings
    validation.warnings.forEach(warning => {
      switch (warning.severity) {
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;