class BillParser {
  constructor() {
    this.currencySymbols = ['₹', 'Rs', 'INR', '$', '€', '£'];
    this.datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,
      /(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
      /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{2,4})/gi,
      /(\d{1,2})\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{2,4})/gi
    ];
    this.pricePatterns = [
      /₹\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      /Rs\.?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      /INR\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*₹/g
    ];
  }

  // Main parsing function
  parseBillData(ocrText) {
    console.log('🔄 Starting bill parsing...');
    const startTime = Date.now();

    try {
      const lines = this.preprocessText(ocrText);
      
      const billData = {
        date: this.extractDate(lines),
        storeName: this.extractStoreName(lines),
        storeAddress: this.extractStoreAddress(lines),
        billNumber: this.extractBillNumber(lines),
        items: this.extractItems(lines),
        subtotal: 0,
        tax: 0,
        taxRate: 0,
        discount: 0,
        total: 0,
        currency: this.detectCurrency(ocrText),
        rawText: ocrText
      };

      // Extract financial totals
      this.extractFinancialTotals(lines, billData);
      
      // Calculate derived values
      this.calculateDerivedValues(billData);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Bill parsing completed in ${processingTime}ms`);
      
      return billData;

    } catch (error) {
      console.error('❌ Bill parsing failed:', error);
      throw new Error(`Bill parsing failed: ${error.message}`);
    }
  }

  // Preprocess OCR text into clean lines
  preprocessText(text) {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/\s+/g, ' '));
  }

  // Extract date from bill
  extractDate(lines) {
    const dateKeywords = ['date', 'dt', 'dated', 'bill date', 'invoice date'];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Check if line contains date keywords
      const hasDateKeyword = dateKeywords.some(keyword => lowerLine.includes(keyword));
      
      if (hasDateKeyword) {
        const dateMatch = this.findDateInLine(line);
        if (dateMatch) return dateMatch;
      }
    }

    // Fallback: search all lines for date patterns
    for (const line of lines) {
      const dateMatch = this.findDateInLine(line);
      if (dateMatch) return dateMatch;
    }

    return '';
  }

  // Find date in a specific line
  findDateInLine(line) {
    for (const pattern of this.datePatterns) {
      const matches = [...line.matchAll(pattern)];
      if (matches.length > 0) {
        return this.formatDate(matches[0][0]);
      }
    }
    return null;
  }

  // Format date to standard format
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      return dateString;
    } catch {
      return dateString;
    }
  }

  // Extract store name
  extractStoreName(lines) {
    // Usually the store name is in the first few lines
    const storeKeywords = ['store', 'mart', 'shop', 'market', 'retail', 'supermarket', 'grocery'];
    
    // Check first 3 lines for store name
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i];
      if (line.length > 5 && line.length < 50) {
        // If line contains store keywords or is likely a business name
        const lowerLine = line.toLowerCase();
        if (storeKeywords.some(keyword => lowerLine.includes(keyword)) || 
            /^[A-Z\s&]+$/.test(line) || 
            line.includes('LTD') || line.includes('PVT')) {
          return line;
        }
      }
    }

    // Fallback: return first non-empty line if it looks like a name
    if (lines.length > 0 && lines[0].length > 3) {
      return lines[0];
    }

    return '';
  }

  // Extract store address
  extractStoreAddress(lines) {
    const addressKeywords = ['address', 'add', 'location', 'street', 'road', 'avenue', 'pin', 'pincode'];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (addressKeywords.some(keyword => lowerLine.includes(keyword))) {
        return line;
      }
    }

    // Look for lines that look like addresses (contain numbers and common address terms)
    for (const line of lines) {
      if (/\d+.*(?:street|road|avenue|lane|block|plot|house|building)/i.test(line)) {
        return line;
      }
    }

    return '';
  }

  // Extract bill number
  extractBillNumber(lines) {
    const billKeywords = ['bill', 'invoice', 'receipt', 'no', 'number', '#'];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (billKeywords.some(keyword => lowerLine.includes(keyword))) {
        // Extract alphanumeric code after keywords
        const match = line.match(/(?:bill|invoice|receipt|no\.?|#)\s*:?\s*([A-Z0-9\-]+)/i);
        if (match) return match[1];
      }
    }

    // Look for standalone alphanumeric codes
    for (const line of lines) {
      if (/^[A-Z0-9\-]{3,15}$/.test(line.trim())) {
        return line.trim();
      }
    }

    return '';
  }

  // Extract items from bill
  extractItems(lines) {
    const items = [];
    const itemStartKeywords = ['item', 'product', 'description', '====', '----', 'qty', 'quantity'];
    const itemEndKeywords = ['subtotal', 'sub total', 'total', 'tax', 'gst', '====', '----', 'discount', 'amount'];
    
    let inItemSection = false;
    let itemStartIndex = -1;
    let itemEndIndex = lines.length;

    // Find item section boundaries
    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      
      if (!inItemSection && (itemStartKeywords.some(keyword => lowerLine.includes(keyword)) || 
                            this.looksLikeItemLine(lines[i]))) {
        inItemSection = true;
        itemStartIndex = i;
      }
      
      if (inItemSection && itemEndKeywords.some(keyword => lowerLine.includes(keyword)) && 
          !this.looksLikeItemLine(lines[i])) {
        itemEndIndex = i;
        break;
      }
    }

    // Extract items from identified section
    for (let i = Math.max(0, itemStartIndex); i < itemEndIndex; i++) {
      const item = this.parseItemLine(lines[i]);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  // Check if a line looks like an item line
  looksLikeItemLine(line) {
    // Line should contain text and a price
    const hasPrice = this.extractPriceFromLine(line) !== null;
    const hasText = /[A-Za-z]{2,}/.test(line);
    const isNotTotal = !/(?:total|subtotal|tax|gst|amount|discount):/i.test(line);
    
    return hasPrice && hasText && isNotTotal && line.length > 5;
  }

  // Parse individual item line
  parseItemLine(line) {
    try {
      const price = this.extractPriceFromLine(line);
      if (!price) return null;

      // Remove price from line to get item description
      const priceRegex = /₹\s*\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*₹|Rs\.?\s*\d+(?:,\d{3})*(?:\.\d{2})?/g;
      let itemDescription = line.replace(priceRegex, '').trim();

      // Extract quantity if present
      let quantity = 1;
      const qtyMatch = itemDescription.match(/(\d+)\s*(?:x|pcs?|kg|gm?|ml|ltr?)\b/i);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1]);
        itemDescription = itemDescription.replace(qtyMatch[0], '').trim();
      }

      // Clean up item description
      itemDescription = itemDescription
        .replace(/^\d+\.?\s*/, '') // Remove leading numbers
        .replace(/\s+/g, ' ')
        .trim();

      if (itemDescription.length < 2) return null;

      const unitPrice = price / quantity;

      return {
        name: itemDescription,
        quantity: quantity,
        unitPrice: parseFloat(unitPrice.toFixed(2)),
        price: parseFloat(price.toFixed(2))
      };

    } catch (error) {
      console.warn('Failed to parse item line:', line, error.message);
      return null;
    }
  }

  // Extract price from line
  extractPriceFromLine(line) {
    for (const pattern of this.pricePatterns) {
      const matches = [...line.matchAll(pattern)];
      if (matches.length > 0) {
        // Get the last price match (usually the item price)
        const lastMatch = matches[matches.length - 1];
        const priceStr = lastMatch[1] || lastMatch[0];
        return parseFloat(priceStr.replace(/,/g, ''));
      }
    }
    return null;
  }

  // Extract financial totals
  extractFinancialTotals(lines, billData) {
    const totalKeywords = {
      subtotal: ['subtotal', 'sub total', 'sub-total', 'amount'],
      tax: ['tax', 'gst', 'vat', 'cgst', 'sgst', 'igst'],
      discount: ['discount', 'off', 'reduction'],
      total: ['total', 'grand total', 'final total', 'net total', 'amount payable']
    };

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Extract subtotal
      if (totalKeywords.subtotal.some(keyword => lowerLine.includes(keyword)) && 
          !lowerLine.includes('tax') && !lowerLine.includes('total')) {
        const price = this.extractPriceFromLine(line);
        if (price && price > 0) billData.subtotal = price;
      }
      
      // Extract tax
      if (totalKeywords.tax.some(keyword => lowerLine.includes(keyword))) {
        const price = this.extractPriceFromLine(line);
        if (price && price >= 0) {
          billData.tax += price; // Add multiple tax components
          
          // Extract tax rate if present
          const rateMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
          if (rateMatch) {
            billData.taxRate = Math.max(billData.taxRate, parseFloat(rateMatch[1]));
          }
        }
      }
      
      // Extract discount
      if (totalKeywords.discount.some(keyword => lowerLine.includes(keyword))) {
        const price = this.extractPriceFromLine(line);
        if (price && price > 0) billData.discount = price;
      }
      
      // Extract total (should be last to avoid subtotal confusion)
      if (totalKeywords.total.some(keyword => lowerLine.includes(keyword)) && 
          !lowerLine.includes('sub')) {
        const price = this.extractPriceFromLine(line);
        if (price && price > 0) billData.total = price;
      }
    }
  }

  // Calculate derived values
  calculateDerivedValues(billData) {
    // Calculate subtotal from items if not found
    if (billData.subtotal === 0 && billData.items.length > 0) {
      billData.subtotal = billData.items.reduce((sum, item) => sum + item.price, 0);
    }

    // Calculate tax rate if not found
    if (billData.taxRate === 0 && billData.subtotal > 0 && billData.tax > 0) {
      billData.taxRate = (billData.tax / billData.subtotal) * 100;
    }

    // Calculate total if not found
    if (billData.total === 0) {
      billData.total = billData.subtotal + billData.tax - billData.discount;
    }

    // Round to 2 decimal places
    billData.subtotal = parseFloat(billData.subtotal.toFixed(2));
    billData.tax = parseFloat(billData.tax.toFixed(2));
    billData.taxRate = parseFloat(billData.taxRate.toFixed(2));
    billData.discount = parseFloat(billData.discount.toFixed(2));
    billData.total = parseFloat(billData.total.toFixed(2));
  }

  // Detect currency
  detectCurrency(text) {
    if (text.includes('₹') || text.includes('Rs') || text.includes('INR')) return '₹';
    if (text.includes(')) return ';
    if (text.includes('€')) return '€';
    if (text.includes('£')) return '£';
    return '₹'; // Default to Indian Rupee
  }

  // Validate parsed data
  validateParsedData(billData) {
    const issues = [];

    // Check for missing essential data
    if (billData.items.length === 0) {
      issues.push('No items found in bill');
    }

    if (billData.total <= 0) {
      issues.push('Invalid or missing total amount');
    }

    if (billData.subtotal <= 0) {
      issues.push('Invalid or missing subtotal');
    }

    // Check mathematical consistency
    const calculatedSubtotal = billData.items.reduce((sum, item) => sum + item.price, 0);
    if (Math.abs(calculatedSubtotal - billData.subtotal) > 0.01) {
      issues.push('Subtotal does not match sum of items');
    }

    const calculatedTotal = billData.subtotal + billData.tax - billData.discount;
    if (Math.abs(calculatedTotal - billData.total) > 0.01) {
      issues.push('Total does not match subtotal + tax - discount');
    }

    // Check for unrealistic values
    if (billData.taxRate > 50) {
      issues.push('Tax rate seems unreasonably high');
    }

    if (billData.discount > billData.subtotal) {
      issues.push('Discount exceeds subtotal');
    }

    return {
      isValid: issues.length === 0,
      issues: issues
    };
  }

  // Get parsing statistics
  getParsingStats(billData) {
    return {
      itemsFound: billData.items.length,
      hasDate: Boolean(billData.date),
      hasStoreName: Boolean(billData.storeName),
      hasBillNumber: Boolean(billData.billNumber),
      hasSubtotal: billData.subtotal > 0,
      hasTax: billData.tax > 0,
      hasDiscount: billData.discount > 0,
      hasTotal: billData.total > 0,
      currency: billData.currency,
      textLength: billData.rawText.length
    };
  }

  // Advanced item recognition with ML-like patterns
  recognizeItemPatterns(lines) {
    const commonItems = {
      food: ['rice', 'wheat', 'sugar', 'salt', 'oil', 'milk', 'bread', 'butter', 'cheese', 'egg', 'chicken', 'fish', 'vegetable', 'fruit'],
      household: ['soap', 'shampoo', 'detergent', 'toothpaste', 'toilet paper', 'tissue', 'cleanser'],
      beverages: ['tea', 'coffee', 'juice', 'water', 'soda', 'beer', 'wine'],
      electronics: ['battery', 'bulb', 'cable', 'charger', 'phone', 'laptop'],
      clothing: ['shirt', 'pant', 'dress', 'shoe', 'sock', 'underwear']
    };

    const recognizedItems = [];

    for (const line of lines) {
      if (this.looksLikeItemLine(line)) {
        const item = this.parseItemLine(line);
        if (item) {
          // Categorize item
          const itemName = item.name.toLowerCase();
          for (const [category, keywords] of Object.entries(commonItems)) {
            if (keywords.some(keyword => itemName.includes(keyword))) {
              item.category = category;
              break;
            }
          }
          
          if (!item.category) {
            item.category = 'other';
          }

          recognizedItems.push(item);
        }
      }
    }

    return recognizedItems;
  }

  // Extract additional metadata
  extractMetadata(lines, ocrText) {
    const metadata = {
      language: this.detectLanguage(ocrText),
      billType: this.detectBillType(lines),
      paymentMethod: this.extractPaymentMethod(lines),
      cashier: this.extractCashier(lines),
      terminalId: this.extractTerminalId(lines)
    };

    return metadata;
  }

  // Detect language
  detectLanguage(text) {
    const hindiChars = /[\u0900-\u097F]/;
    const englishChars = /[A-Za-z]/;
    
    const hindiCount = (text.match(hindiChars) || []).length;
    const englishCount = (text.match(englishChars) || []).length;
    
    if (hindiCount > englishCount) return 'hindi';
    if (englishCount > 0) return 'english';
    return 'unknown';
  }

  // Detect bill type
  detectBillType(lines) {
    const text = lines.join(' ').toLowerCase();
    
    if (text.includes('grocery') || text.includes('supermarket')) return 'grocery';
    if (text.includes('restaurant') || text.includes('hotel') || text.includes('cafe')) return 'restaurant';
    if (text.includes('pharmacy') || text.includes('medical')) return 'pharmacy';
    if (text.includes('fuel') || text.includes('petrol') || text.includes('diesel')) return 'fuel';
    if (text.includes('electronic') || text.includes('mobile') || text.includes('computer')) return 'electronics';
    
    return 'retail';
  }

  // Extract payment method
  extractPaymentMethod(lines) {
    const text = lines.join(' ').toLowerCase();
    
    if (text.includes('cash')) return 'cash';
    if (text.includes('card') || text.includes('credit') || text.includes('debit')) return 'card';
    if (text.includes('upi') || text.includes('paytm') || text.includes('gpay') || text.includes('phonepe')) return 'upi';
    if (text.includes('netbanking') || text.includes('net banking')) return 'netbanking';
    
    return 'unknown';
  }

  // Extract cashier info
  extractCashier(lines) {
    for (const line of lines) {
      if (line.toLowerCase().includes('cashier')) {
        const match = line.match(/cashier[:\s]+([A-Za-z\s]+)/i);
        if (match) return match[1].trim();
      }
    }
    return '';
  }

  // Extract terminal ID
  extractTerminalId(lines) {
    for (const line of lines) {
      const match = line.match(/(?:terminal|pos|till)[:\s#]*([A-Z0-9]+)/i);
      if (match) return match[1];
    }
    return '';
  }
}

module.exports = new BillParser();