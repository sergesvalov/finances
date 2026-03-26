import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api';

const UploadStatement = () => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [result, setResult] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await api.post('/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setResult({ error: err.response?.data?.detail || err.message });
      setStatus('error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Upload Bank Statement</h1>
      </div>
      
      <div className="card">
        <div 
          className={`upload-area ${isDragging ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
           <UploadCloud size={64} className="upload-icon" />
           <h3>{file ? file.name : 'Click or Drag & Drop CSV Here'}</h3>
           <p className="text-muted" style={{marginTop: '0.5rem'}}>Only .csv files from Revolut are supported</p>
           <input 
             type="file" 
             id="fileInput" 
             accept=".csv" 
             style={{ display: 'none' }}
             onChange={handleFileChange}
           />
        </div>
        
        {file && (
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleUpload}
              disabled={status === 'uploading'}
            >
              {status === 'uploading' ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        )}
        
        {status === 'success' && result && (
           <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <CheckCircle color="var(--success)" />
              <div>
                <h4 style={{ color: 'var(--success)' }}>Import Successful</h4>
                <p>Imported: {result.imported_rows} rows. Skipped (duplicates): {result.skipped_rows} rows.</p>
              </div>
           </div>
        )}

        {status === 'error' && result && (
           <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <AlertCircle color="var(--danger)" />
              <div>
                <h4 style={{ color: 'var(--danger)' }}>Import Failed</h4>
                <p>{result.error}</p>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default UploadStatement;
