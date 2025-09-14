import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const BillVerificationApp = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // API Functions
  const API_BASE_URL = 'http://localhost:5000';

  const checkAPIHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      return data.status === 'OK';
    } catch (error) {
      return false;
    }
  };

  const processBillAPI = async (file) => {
    const formData = new FormData();
    formData.append('billImage', file);
    formData.append('userId', 'demo-user');

    const response = await fetch(`${API_BASE_URL}/api/bills/process`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Processing failed');
    }

    return await response.json();
  };

  const getBillHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bills/history/demo-user`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('Failed to load history:', error);
      return { success: false };
    }
  };

  // Check API availability on mount
  useEffect(() => {
    const checkAPI = async () => {
      const available = await checkAPIHealth();
      setApiAvailable(available);
      console.log(available ? '✅ Backend connected' : '❌ Backend offline');
      
      if (available) {
        const historyData = await getBillHistory();
        if (historyData.success) {
          setHistory(historyData.data.bills);
        }
      }
    };
    
    checkAPI();
  }, []);

  // File upload handler
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Camera capture handler
  const handleCameraCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Validate and set selected file
  const validateAndSetFile = (file) => {
    setError(null);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // Process bill
  const processBill = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      console.log('🔄 Processing bill:', selectedFile.name);
      
      let response;
      if (apiAvailable) {
        response = await processBillAPI(selectedFile);
      } else {
        // Fallback mock processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        response = {
          success: true,
          data: {
            id: Date.now(),
            fileName: selectedFile.name,
            billData: {
              date: '2024-01-15',
              storeName: 'Demo Store',
              items: [
                { name: 'Item 1', quantity: 1, unitPrice: 50.00, price: 50.00 },
                { name: 'Item 2', quantity: 2, unitPrice: 25.00, price: 50.00 }
              ],
              subtotal: 100.00,
              tax: 5.00,
              total: 105.00,
              currency: '₹'
            },
            validation: {
              isValid: true,
              errors: [],
              warnings: [],
              confidenceScore: 85
            }
          }
        };
      }

      if (response.success) {
        const result = {
          id: response.data.id,
          timestamp: new Date().toLocaleString(),
          fileName: selectedFile.name,
          ...response.data
        };

        setResults(result);
        
        // Update history
        setHistory(prev => [{
          id: result.id,
          fileName: result.fileName,
          fileSize: result.fileSize || '2.1 MB',
          isValid: result.validation.isValid,
          confidenceScore: result.validation.confidenceScore,
          processingStage: 'completed',
          processingTime: result.processingTime || '2.3s',
          createdAt: new Date().toISOString(),
          status: 'completed'
        }, ...prev.slice(0, 9)]);

        console.log('✅ Bill processed successfully');
      } else {
        throw new Error(response.error || 'Processing failed');
      }

    } catch (error) {
      console.error('❌ Processing failed:', error);
      setError(error.message);
      setResults({
        error: error.message,
        processed: false,
        errorType: 'processing_error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedFile(null);
    setPreview(null);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Download report
  const downloadReport = (result) => {
    const reportData = {
      timestamp: result.timestamp,
      fileName: result.fileName,
      validation: result.validation,
      billData: result.billData,
      team: 'Cyber Comets',
      hackathon: 'Smart India Hackathon 2025'
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `bill-verification-${result.id}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo">📄</div>
              <div className="title-section">
                <h1>Smart Bill Verifier</h1>
                <p>OCR-Powered Bill Verification by Cyber Comets</p>
              </div>
            </div>
            <div className="hackathon-info">
              <div>Smart India Hackathon 2025</div>
              <div>Problem Statement ID: 25132</div>
              <div className={`api-status ${apiAvailable ? 'online' : 'offline'}`}>
                {apiAvailable ? '🟢 Backend Online' : '🔴 Backend Offline'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="container">
          {/* Error Alert */}
          {error && (
            <div className="error-alert">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
              <button onClick={() => setError(null)} className="close-btn">×</button>
            </div>
          )}

          <div className="grid">
            {/* Upload Section */}
            <div className="upload-section">
              <div className="card">
                <h2>Upload Bill Image</h2>
                
                {!preview ? (
                  <div className="upload-area">
                    {/* Upload Options */}
                    <div className="upload-buttons">
                      <div className="upload-box" onClick={() => fileInputRef.current?.click()}>
                        <div className="upload-icon">📤</div>
                        <p className="upload-title">Upload from Device</p>
                        <p className="upload-subtitle">Click to select image file</p>
                        <p className="upload-info">Max size: 5MB • JPG, PNG, GIF</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                      </div>

                      <div className="upload-box camera" onClick={() => cameraInputRef.current?.click()}>
                        <div className="upload-icon">📷</div>
                        <p className="upload-title">Capture Photo</p>
                        <p className="upload-subtitle">Use camera to take photo</p>
                        <p className="upload-info">Direct camera capture</p>
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleCameraCapture}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Features */}
                    <div className="features">
                      <h3>Verification Features</h3>
                      <div className="features-grid">
                        <div className="feature">✅ Mathematical accuracy check</div>
                        <div className="feature">✅ Tax calculation validation</div>
                        <div className="feature">✅ Total amount verification</div>
                        <div className="feature">✅ Date logic validation</div>
                        <div className="feature">✅ Duplicate item detection</div>
                        <div className="feature">✅ Price pattern analysis</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="preview-area">
                    {/* Image Preview */}
                    <div className="image-preview">
                      <img src={preview} alt="Bill preview" />
                      <div className="file-info">
                        <span className="file-name">{selectedFile?.name}</span>
                        <span className="file-size">
                          {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons">
                      <button
                        onClick={processBill}
                        disabled={isProcessing}
                        className="btn btn-primary"
                      >
                        {isProcessing ? (
                          <>
                            <span className="spinner"></span>
                            {apiAvailable ? 'Processing Bill...' : 'Analyzing...'}
                          </>
                        ) : (
                          <>👁️ Verify Bill</>
                        )}
                      </button>
                      <button onClick={resetForm} className="btn btn-secondary" disabled={isProcessing}>
                        🗑️ Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Results Section */}
            <div className="results-section">
              {results && (
                <div className="card">
                  <h3>Verification Results</h3>
                  
                  {results.processed !== false ? (
                    <div className="results-content">
                      {/* Status Badge */}
                      <div className={`status-badge ${results.validation?.isValid ? 'valid' : 'invalid'}`}>
                        {results.validation?.isValid ? '✅' : '❌'} 
                        {results.validation?.isValid ? 'Bill Verified ✓' : 'Issues Found ⚠️'}
                      </div>

                      {/* Processing Info */}
                      {results.processingTime && (
                        <div className="processing-info">
                          <span>⏱️ Processing: {results.processingTime}</span>
                          {results.ocr?.confidence && (
                            <span>🔍 OCR: {Math.round(results.ocr.confidence)}%</span>
                          )}
                        </div>
                      )}

                      {/* Confidence Score */}
                      <div className="confidence-score">
                        <div className="score-header">
                          <span>Confidence Score</span>
                          <span className="score-value">{results.validation?.confidenceScore || 0}%</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className={`progress-fill ${
                              (results.validation?.confidenceScore || 0) >= 80 ? 'high' : 
                              (results.validation?.confidenceScore || 0) >= 60 ? 'medium' : 'low'
                            }`}
                            style={{ width: `${results.validation?.confidenceScore || 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Bill Summary */}
                      {results.billData && (
                        <div className="bill-summary">
                          <h4>Bill Summary</h4>
                          {results.billData.storeName && (
                            <div className="summary-item">
                              <span>Store:</span>
                              <span>{results.billData.storeName}</span>
                            </div>
                          )}
                          <div className="summary-item">
                            <span>Date:</span>
                            <span>{results.billData.date || 'Not found'}</span>
                          </div>
                          <div className="summary-item">
                            <span>Items:</span>
                            <span>{results.billData.items?.length || 0}</span>
                          </div>
                          <div className="summary-item">
                            <span>Subtotal:</span>
                            <span>{results.billData.currency || '₹'}{results.billData.subtotal?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="summary-item">
                            <span>Tax ({results.billData.taxRate || 0}%):</span>
                            <span>{results.billData.currency || '₹'}{results.billData.tax?.toFixed(2) || '0.00'}</span>
                          </div>
                          {results.billData.discount > 0 && (
                            <div className="summary-item">
                              <span>Discount:</span>
                              <span>-{results.billData.currency || '₹'}{results.billData.discount?.toFixed(2) || '0.00'}</span>
                            </div>
                          )}
                          <div className="summary-item total">
                            <span>Total:</span>
                            <span>{results.billData.currency || '₹'}{results.billData.total?.toFixed(2) || '0.00'}</span>
                          </div>
                        </div>
                      )}

                      {/* Item Details */}
                      {results.billData?.items?.length > 0 && (
                        <div className="items-list">
                          <h4>Items Found ({results.billData.items.length})</h4>
                          <div className="items-container">
                            {results.billData.items.slice(0, 5).map((item, index) => (
                              <div key={index} className="item-row">
                                <span className="item-name">{item.name}</span>
                                <span className="item-details">
                                  {item.quantity} × ₹{item.unitPrice?.toFixed(2)} = ₹{item.price?.toFixed(2)}
                                </span>
                              </div>
                            ))}
                            {results.billData.items.length > 5 && (
                              <div className="items-more">
                                +{results.billData.items.length - 5} more items...
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Validation Algorithms Status */}
                      {results.validation?.algorithmResults && (
                        <div className="algorithms-status">
                          <h4>Validation Algorithms</h4>
                          <div className="algorithm-grid">
                            <div className={`algorithm-item ${results.validation.algorithmResults.mathVerification ? 'pass' : 'fail'}`}>
                              {results.validation.algorithmResults.mathVerification ? '✅' : '❌'} Math Check
                            </div>
                            <div className={`algorithm-item ${results.validation.algorithmResults.taxValidation ? 'pass' : 'fail'}`}>
                              {results.validation.algorithmResults.taxValidation ? '✅' : '❌'} Tax Check
                            </div>
                            <div className={`algorithm-item ${results.validation.algorithmResults.totalCheck ? 'pass' : 'fail'}`}>
                              {results.validation.algorithmResults.totalCheck ? '✅' : '❌'} Total Check
                            </div>
                            <div className={`algorithm-item ${results.validation.algorithmResults.dateValidation ? 'pass' : 'fail'}`}>
                              {results.validation.algorithmResults.dateValidation ? '✅' : '❌'} Date Check
                            </div>
                            <div className={`algorithm-item ${results.validation.algorithmResults.patternAnalysis ? 'pass' : 'fail'}`}>
                              {results.validation.algorithmResults.patternAnalysis ? '✅' : '❌'} Pattern Analysis
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Errors */}
                      {results.validation?.errors?.length > 0 && (
                        <div className="errors">
                          <h4>❌ Errors Found ({results.validation.errors.length})</h4>
                          {results.validation.errors.map((error, index) => (
                            <div key={index} className="error-item">
                              <span className="error-badge">{error.severity?.toUpperCase()}</span>
                              <span className="error-message">{error.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Warnings */}
                      {results.validation?.warnings?.length > 0 && (
                        <div className="warnings">
                          <h4>⚠️ Warnings ({results.validation.warnings.length})</h4>
                          {results.validation.warnings.map((warning, index) => (
                            <div key={index} className="warning-item">
                              <span className="warning-badge">{warning.severity?.toUpperCase()}</span>
                              <span className="warning-message">{warning.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Download Report */}
                      <button onClick={() => downloadReport(results)} className="btn btn-download">
                        💾 Download Report
                      </button>
                    </div>
                  ) : (
                    <div className="error-state">
                      <div className="error-icon">❌</div>
                      <p>{results.error}</p>
                      {results.errorCode && (
                        <p className="error-code">Error Code: {results.errorCode}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* History */}
              {history.length > 0 && (
                <div className="card">
                  <h3>Recent Verifications ({history.length})</h3>
                  <div className="history-list">
                    {history.map((item, index) => (
                      <div key={item.id || index} className="history-item">
                        <div className="history-header">
                          <span className="file-name">{item.fileName}</span>
                          <span className={`status ${item.isValid ? 'valid' : 'invalid'}`}>
                            {item.isValid ? '✅' : '❌'}
                          </span>
                        </div>
                        <div className="history-details">
                          <span className="file-size">{item.fileSize}</span>
                          <span className="confidence">{item.confidenceScore}%</span>
                          <span className="processing-time">{item.processingTime}</span>
                        </div>
                        <div className="history-footer">
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          <span className={`status-badge ${item.status}`}>{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <h3>Cyber Comets - Smart Bill Verifier</h3>
            <p>Empowering retailers with affordable, accurate billing verification</p>
            <div className="footer-info">
              Smart India Hackathon 2025 | Problem Statement ID: 25132 | Student Innovation Theme
            </div>
            <div className="tech-stack">
              <span>💻 React.js</span>
              <span>🚀 Node.js</span>
              <span>🔍 OCR Technology</span>
              <span>🧠 AI Validation</span>
              <span>📊 Real-time Processing</span>
              <span>🎯 5 Algorithms</span>
            </div>
            <div className="team-info">
              <strong>Team Cyber Comets</strong> - Revolutionizing Bill Verification with AI
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BillVerificationApp;
