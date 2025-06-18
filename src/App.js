import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState('');
  const [validEmails, setValidEmails] = useState([]);
  const [invalidEmails, setInvalidEmails] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    resetState();
    setStatus('File uploaded.');
  };

  const resetState = () => {
    setValidEmails([]);
    setInvalidEmails([]);
    setLog([]);
    setError('');
    setStatus('');
  };

  const handleVerify = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setVerifying(true);
    setStatus('Verifying emails...');
    setLog([]);
    setValidEmails([]);
    setInvalidEmails([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(
        'https://email-verifier-backend-sgr0.onrender.com/verify',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const results = res.data;
      let valid = [];
      let invalid = [];

      for (let i = 0; i < results.length; i++) {
        const entry = results[i];
        if (entry.status === 'Valid') {
          valid.push(entry.email);
        } else {
          invalid.push(entry.email);
        }

        setLog((prevLog) => [
          ...prevLog,
          `✔️ ${entry.email} → ${entry.status}`
        ]);
        await new Promise((r) => setTimeout(r, 100)); // Simulate delay
      }

      setValidEmails(valid);
      setInvalidEmails(invalid);
      setStatus('Verification complete.');
    } catch (err) {
      console.error(err);
      setError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const downloadCSV = (emails, type) => {
    const csv = emails.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${type}-emails.csv`;
    link.click();
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h2>Email Verifier ✅</h2>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        title="Upload a CSV file"
        style={{ marginBottom: '1rem' }}
      />
      <br />
      <button onClick={handleVerify} disabled={verifying}>
        {verifying ? 'Verifying...' : 'Verify'}
      </button>

      {status && <p><strong>Status:</strong> {status}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {log.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Live Log</h3>
          <ul style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {(validEmails.length > 0 || invalidEmails.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Download Results</h3>
          {validEmails.length > 0 && (
            <button onClick={() => downloadCSV(validEmails, 'valid')}>
              📥 Download Valid Emails ({validEmails.length})
            </button>
          )}
          {invalidEmails.length > 0 && (
            <button onClick={() => downloadCSV(invalidEmails, 'invalid')} style={{ marginLeft: '1rem' }}>
              📥 Download Invalid Emails ({invalidEmails.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
