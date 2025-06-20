import React, { useState } from 'react';

/* ──────────────────────────────────────────────────────────
   MULTI-GATEWAY ROTATION (AWS-1, AWS-2, Railway)
─────────────────────────────────────────────────────────── */
const GATEWAYS = [
  "http://44.201.247.203:10000",     // AWS EC2 - East
  "http://52.53.243.135:10000",      // AWS EC2 - West
  "https://web-production-0d962.up.railway.app"  // Railway Gateway
];

const getGateway = () =>
  GATEWAYS[Math.floor(Math.random() * GATEWAYS.length)];

export default function App() {
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
  const [proxyTest, setProxyTest] = useState('');

  const resetUI = () => {
    setLog([]);
    setValidEmails([]);
    setInvalidEmails([]);
    setStatus('');
    setError('');
  };

  const handleFile = e => {
    setFile(e.target.files[0]);
    resetUI();
    setStatus('File ready.');
  };

  const testProxy = async () => {
    try {
      const r = await fetch(`${getGateway()}/test-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy, proxyUser, proxyPass })
      });
      const j = await r.json();
      setProxyTest(j.status || 'Unknown');
    } catch (e) {
      console.error(e);
      setProxyTest('Proxy connection failed');
    }
  };

  const startVerify = async () => {
    if (!file) return setError('Choose a CSV first.');

    setVerifying(true);
    setError('');
    setStatus('Uploading & verifying…');

    const form = new FormData();
    form.append('file', file);
    form.append('proxy', proxy.trim());
    form.append('proxyUser', proxyUser.trim());
    form.append('proxyPass', proxyPass.trim());

    try {
      const r = await fetch(`${getGateway()}/verify`, { method: 'POST', body: form });
      if (!r.ok || !r.body) throw new Error('stream failed');

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        parts.forEach(line => {
          if (!line.startsWith('data: ')) return;
          const entry = JSON.parse(line.slice(6));

          setLog(prev => [...prev, `✔️ ${entry.email} → ${entry.status}`]);

          if (entry.status.startsWith('Valid')) setValidEmails(p => [...p, entry.email]);
          else if (entry.status.startsWith('Invalid')) setInvalidEmails(p => [...p, entry.email]);
        });
      }
      setStatus('Verification complete.');
    } catch (e) {
      console.error(e);
      setError('Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const download = (arr, tag) => {
    const blob = new Blob([arr.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${tag}-emails.csv`;
    a.click();
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h2>Email Verifier ✅</h2>

      {/* proxy (optional) */}
      <div style={{ marginBottom: '1rem' }}>
        <label>SOCKS Proxy (IP:Port)</label><br />
        <input value={proxy} onChange={e => setProxy(e.target.value)} placeholder="123.123.123.123:1080" />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label>User</label><br />
        <input value={proxyUser} onChange={e => setProxyUser(e.target.value)} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label>Password</label><br />
        <input type="password" value={proxyPass} onChange={e => setProxyPass(e.target.value)} />
      </div>
      <button onClick={testProxy} style={{ marginBottom: '1rem' }}>🧪 Test Proxy</button>
      {proxyTest && <p><strong>Proxy:</strong> {proxyTest}</p>}

      {/* file upload */}
      <input type="file" accept=".csv" onChange={handleFile} style={{ marginBottom: '1rem' }} /><br />

      <button onClick={startVerify} disabled={verifying}>
        {verifying ? 'Verifying…' : 'Verify'}
      </button>

      {status && <p><strong>Status:</strong> {status}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* live log */}
      {log.length > 0 && (
        <div style={{ marginTop: '1rem', maxHeight: 200, overflowY: 'auto' }}>
          <h3>Live Log</h3>
          <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}

      {/* downloads */}
      {(validEmails.length || invalidEmails.length) && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Download results</h3>
          {validEmails.length > 0 &&
            <button onClick={() => download(validEmails, 'valid')}>
              📥 Valid ({validEmails.length})
            </button>}
          {invalidEmails.length > 0 &&
            <button onClick={() => download(invalidEmails, 'invalid')} style={{ marginLeft: '1rem' }}>
              📥 Invalid ({invalidEmails.length})
            </button>}
        </div>
      )}
    </div>
  );
}
