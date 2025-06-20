import React, { useState, useRef } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState('');
  const [validEmails, setValidEmails] = useState([]);
  const [invalidEmails, setInvalidEmails] = useState([]);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [proxy, setProxy] = useState('');
  const [proxyUser, setProxyUser] = useState('');
  const [proxyPass, setProxyPass] = useState('');
  const [proxyTestResult, setProxyTestResult] = useState('');
  const eventSourceRef = useRef(null);

  // 🔁 Backend pool to randomly select from
  const backendUrls = [
    'http://ec2-44-201-247-203.compute-1.amazonaws.com:10000',
    'http://ec2-52-53-243-135.us-west-1.compute.amazonaws.com:10000',
    'https://your-railway-url.com' // <-- Replace with your actual Railway backend
  ];

  const getRandomBackend = () => {
    return backendUrls[Math.floor(Math.random() * backendUrls.length)];
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setLog([]);
    setValidEmails([]);
    setInvalidEmails([]);
    setStatus('File uploaded.');
    setError('');
  };

  const handleTestProxy = async () => {
    const backend = getRandomBackend();
    try {
      const res = await fetch(`${backend}/test-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy,
          proxyUser,
          proxyPass
        })
      });

      const data = await res.json();
      setProxyTestResult(data?.status || 'Failed');
    } catch (err) {
      console.error('Proxy test failed:', err);
      setProxyTestResult('Proxy connection failed');
    }
  };

  const handleVerify = async () => {
    if (!file) {
      setError('Please select a file.');
      return;
    }

    const backend = getRandomBackend();
    setVerifying(true);
    setStatus('Uploading file and verifying...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('proxy', proxy.trim());
    formData.append('proxyUser', proxyUser.trim());
    formData.append('proxyPass', proxyPass.trim());

    try {
      const res = await fetch(`${backend}/verify`, {
        method: 'POST',
        body: formData,
      });

      if (!res.body || !res.ok) {
        throw new Error('Streaming failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = line.slice(6);
            const entry = JSON.parse(json);
            setLog((prev) => [...prev, `✔️ ${entry.email} → ${entry.status}`]);

            if (entry.status === 'Valid') {
              setValidEmails((prev) => [...prev, entry.email]);
            } else {
              setInvalidEmails((prev) => [...prev, entry.email]);
            }
          }
        }
      }

      setStatus('Verification complete.');
    } catch (err) {
      console.error('Verification error:', err);
      setError('Verification failed. Try again.');
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

      <div style={{ marginBottom: '1rem' }}>
        <label>SOCKS Proxy (IP:Port):</label><br />
        <input type="text" value={proxy} onChange={(e) => setProxy(e.target.value)} placeholder="e.g. 123.123.123.123:1080" />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Proxy Username (optional):</label><br />
        <input type="text" value={proxyUser} onChange={(e) => setProxyUser(e.target.value)} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Proxy Password (optional):</label><br />
        <input type="password" value={proxyPass} onChange={(e) => setProxyPass(e.target.value)} />
      </div>

      <button onClick={handleTestProxy} style={{ marginBottom: '1rem' }}>
        🧪 Test SOCKS Proxy
      </button>

      {proxyTestResult && <p><strong>Proxy Status:</strong> {proxyTestResult}</p>}

      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        title="Upload CSV"
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
            {log.map((entry, i) => (
              <li key={i}>{entry}</li>
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