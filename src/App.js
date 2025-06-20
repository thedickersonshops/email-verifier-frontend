// ✅ FINAL FRONTEND (App.js)
import React, { useState } from 'react';

const GATEWAYS = [
  "https://email-gateway-production-a491.up.railway.app",
  "http://44.201.247.203:8000",
  "http://52.53.153.46:8000"
];

const getGateway = () => GATEWAYS[Math.floor(Math.random() * GATEWAYS.length)];

export default function App() {
  const [file, setFile] = useState(null);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState('');
  const [validEmails, setValidEmails] = useState([]);
  const [invalidEmails, setInvalidEmails] = useState([]);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [emailCount, setEmailCount] = useState(0);

  const [proxies, setProxies] = useState('');
  const [proxyTest, setProxyTest] = useState('');

  const resetUI = () => {
    setLog([]);
    setValidEmails([]);
    setInvalidEmails([]);
    setStatus('');
    setError('');
    setEmailCount(0);
  };

  const handleFile = e => {
    const f = e.target.files[0];
    setFile(f);
    resetUI();
    setStatus('Reading file...');
    const reader = new FileReader();
    reader.onload = evt => {
      const lines = evt.target.result.split(/\r?\n/);
      const emails = lines.filter(line => line.includes('@'));
      setEmailCount(emails.length);
      setStatus(`File ready. ${emails.length} emails.`);
    };
    reader.readAsText(f);
  };

  const testProxy = async () => {
    try {
      const firstProxy = proxies.trim().split(/\r?\n/)[0];
      const r = await fetch(`${getGateway()}/test-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy: firstProxy })
      });
      const j = await r.json();
      setProxyTest(j.status || 'Unknown');
    } catch (e) {
      console.error(e);
      setProxyTest('Proxy test failed ❌');
    }
  };

  const startVerify = async () => {
    if (!file) return setError('Please choose a CSV file.');

    setVerifying(true);
    setError('');
    setStatus('Uploading & verifying...');

    const form = new FormData();
    form.append('file', file);
    form.append('proxy', proxies.trim());

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
          if (entry.info) {
            setStatus(entry.info);
          } else {
            setLog(prev => [...prev, `✔️ ${entry.email} → ${entry.status}`]);
            if (entry.status.startsWith('Valid')) setValidEmails(p => [...p, entry.email]);
            else if (entry.status.startsWith('Invalid')) setInvalidEmails(p => [...p, entry.email]);
          }
        });
      }
      setStatus('✅ Verification complete.');
    } catch (e) {
      console.error(e);
      setError('Verification failed ❌');
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

      {/* Proxy Pool */}
      <label>SOCKS5 Proxies (one per line, format: ip:port[:username:password])</label><br />
      <textarea
        rows={4}
        style={{ width: '100%', marginBottom: '1rem' }}
        value={proxies}
        onChange={e => setProxies(e.target.value)}
        placeholder="123.123.123.123:1080\n123.123.123.124:1080:user:pass"
      ></textarea>
      <button onClick={testProxy}>🧪 Test First Proxy</button>
      {proxyTest && <p><strong>Proxy Test:</strong> {proxyTest}</p>}

      {/* File Upload */}
      <input type="file" accept=".csv" onChange={handleFile} style={{ margin: '1rem 0' }} /><br />

      {emailCount > 0 && <p>📊 Total emails: {emailCount}</p>}

      <button onClick={startVerify} disabled={verifying}>
        {verifying ? 'Verifying…' : '✅ Start Verification'}
      </button>

      {status && <p><strong>Status:</strong> {status}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Live Log */}
      {log.length > 0 && (
        <div style={{ marginTop: '1rem', maxHeight: 200, overflowY: 'auto' }}>
          <h3>📋 Live Log</h3>
          <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}

      {/* Downloads */}
      {(validEmails.length || invalidEmails.length) && (
        <div style={{ marginTop: '2rem' }}>
          <h3>📥 Download Results</h3>
          {validEmails.length > 0 &&
            <button onClick={() => download(validEmails, 'valid')}>
              ✅ Valid ({validEmails.length})
            </button>}
          {invalidEmails.length > 0 &&
            <button onClick={() => download(invalidEmails, 'invalid')} style={{ marginLeft: '1rem' }}>
              ❌ Invalid ({invalidEmails.length})
            </button>}
        </div>
      )}
    </div>
  );
}
