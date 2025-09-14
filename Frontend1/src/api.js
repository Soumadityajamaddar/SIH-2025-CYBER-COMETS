import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ Response Error:', {
      status: error.response?.status,
      message: error.response?.data?.error || error.message,
      url: error.config?.url
    });
    return Promise.reject(error);
  }
);

// Bill API functions
export const billAPI = {
  // Process single bill
  processBill: async (file, userId = 'anonymous') => {
    try {
      const formData = new FormData();
      formData.append('billImage', file);
      formData.append('userId', userId);
      
      const response = await api.post('/bills/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`📤 Upload Progress: ${percentCompleted}%`);
        }
      });
      
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to process bill');
    }
  },

  // Process multiple bills
  processBatch: async (files, userId = 'anonymous') => {
    try {
      const formData = new FormData();
      
      // Append each file
      files.forEach((file, index) => {
        formData.append('billImages', file);
      });
      
      formData.append('userId', userId);
      
      const response = await api.post('/bills/batch', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000, // Extended timeout for batch processing
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`📤 Batch Upload Progress: ${percentCompleted}%`);
        }
      });
      
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to process bills');
    }
  },
  
  // Get bill history
  getBillHistory: async (userId = 'anonymous', options = {}) => {
    try {
      const { limit = 10, offset = 0, status } = options;
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });
      
      if (status) {
        params.append('status', status);
      }
      
      const response = await api.get(`/bills/history/${userId}?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get bill history');
    }
  },
  
  // Get bill report
  getBillReport: async (billId, format = 'json') => {
    try {
      const response = await api.get(`/bills/${billId}?format=${format}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get bill report');
    }
  },
  
  // Download bill report
  downloadBillReport: async (billId, format = 'json') => {
    try {
      const response = await api.get(`/bills/${billId}/download?format=${format}`, {
      }
      
      if (response.type === 'json') {
        return response.data;
      }
    
      // Handle file download for CSV/PDF
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bill-report-${billId}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'Report downloaded successfully' };
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to download report');
    }
  },
  
  // Delete bill
  deleteBill: async (billId, permanent = false) => {
    try {
      const response = await api.delete(`/bills/${billId}?permanent=${permanent}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to delete bill');
    }
  },
  
  // Get statistics
  getStatistics: async () => {
    try {
      const response = await api.get('/bills/stats/overview');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get statistics');
    }
  },
  
  // Check API health
  checkHealth: async () => {
    try {
      const response = await api.get('/bills/health');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'API health check failed');
    }
  },
  
  // Get API documentation
  getDocumentation: async () => {
    try {
      const response = await api.get('/bills/docs');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get documentation');
    }
  }
};

// Utility functions
export const apiUtils = {
  // Check if API is available
  isApiAvailable: async () => {
    try {
      await billAPI.checkHealth();
      return true;
    } catch (error) {
      console.warn('⚠️ API not available, using offline mode');
      return false;
    }
  },
  
  // Format file size
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  // Validate file type
  isValidImageFile: (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return allowedTypes.includes(file.type);
  },
  
  // Check file size limit
  isFileSizeValid: (file, maxSizeMB = 5) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  },
  
  // Handle API errors
  handleApiError: (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return {
            type: 'validation',
            message: data.error || 'Invalid request',
            code: data.code
          };
        case 401:
          return {
            type: 'auth',
            message: 'Authentication required',
            code: data.code
          };
        case 403:
          return {
            type: 'permission',
            message: 'Permission denied',
            code: data.code
          };
        case 404:
          return {
            type: 'not_found',
            message: 'Resource not found',
            code: data.code
          };
        case 429:
          return {
            type: 'rate_limit',
            message: 'Too many requests. Please try again later.',
            code: data.code
          };
        case 500:
          return {
            type: 'server',
            message: 'Server error. Please try again.',
            code: data.code
          };
        default:
          return {
            type: 'unknown',
            message: data.error || 'An error occurred',
            code: data.code
          };
      }
    } else if (error.request) {
      // Network error
      return {
        type: 'network',
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR'
      };
    } else {
      // Other error
      return {
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR'
      };
    }
  },
  
  // Retry mechanism
  retryRequest: async (requestFn, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await requestFn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        console.log(`🔄 Retrying request (attempt ${i + 2}/${maxRetries})`);
      }
    }
  }
};

// Mock API for offline/development mode
export const mockAPI = {
  processBill: async (file) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    
    return {
      success: true,
      data: {
        id: Date.now().toString(),
        fileName: file.name,
        fileSize: apiUtils.formatFileSize(file.size),
        processingTime: '2.3s',
        ocr: {
          confidence: 85 + Math.random() * 10,
          textLength: 450 + Math.random() * 200
        },
        billData: {
          date: '2024-01-15',
          storeName: 'Super Market',
          items: [
            { name: 'Rice Basmati 1kg', quantity: 1, unitPrice: 85.00, price: 85.00 },
            { name: 'Cooking Oil 1L', quantity: 1, unitPrice: 120.00, price: 120.00 },
            { name: 'Sugar White 1kg', quantity: 1, unitPrice: 45.00, price: 45.00 },
            { name: 'Tea Leaves 250g', quantity: 1, unitPrice: 75.00, price: 75.00 }
          ],
          subtotal: 325.00,
          tax: 16.25,
          taxRate: 5,
          discount: 0,
          total: 341.25,
          currency: '₹'
        },
        validation: {
          isValid: Math.random() > 0.3, // 70% chance of being valid
          errors: Math.random() > 0.7 ? [
            {
              type: 'TAX_ERROR',
              message: 'Tax calculation error: Expected ₹16.25 vs Printed ₹17.00',
              severity: 'medium'
            }
          ] : [],
          warnings: Math.random() > 0.5 ? [
            {
              type: 'DUPLICATE_ITEMS',
              message: 'Potential duplicate items found: rice',
              severity: 'low'
            }
          ] : [],
          confidenceScore: Math.floor(75 + Math.random() * 25),
          algorithmResults: {
            mathVerification: true,
            taxValidation: Math.random() > 0.3,
            totalCheck: true,
            dateValidation: true,
            patternAnalysis: true
          }
        },
        processedAt: new Date().toISOString()
      }
    };
  },
  
  getBillHistory: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockBills = [];
    for (let i = 0; i < 5; i++) {
      mockBills.push({
        id: (Date.now() - i * 86400000).toString(),
        fileName: `bill_${i + 1}.jpg`,
        fileSize: '2.3 MB',
        isValid: Math.random() > 0.3,
        confidenceScore: Math.floor(70 + Math.random() * 30),
        processingStage: 'completed',
        processingTime: `${(1.5 + Math.random() * 2).toFixed(1)}s`,
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        status: 'completed'
      });
    }
    
    return {
      success: true,
      data: {
        bills: mockBills,
        pagination: {
          total: mockBills.length,
          limit: 10,
          offset: 0,
          hasMore: false
        }
      }
    };
  }
};

// Export default API object
export default {
  ...billAPI,
  utils: apiUtils,
  mock: mockAPI
};
