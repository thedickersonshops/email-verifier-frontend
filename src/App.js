import React, { useState } from 'react';

const GATEWAYS = [
  "https://email-gateway-production-a491.up.railway.app",       // Railway
  "http://44.201.247.203:8000",                                  // AWS 1
  "http://52.53.153.46:8000"                                     // AWS 2
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
  const [proxyText, setProxyText] = useState('');
  const [proxyTest, setProxyTest] = useState('');
  const [leadCount, setLeadCount] = useState(0);

  const resetUI = () => {
    setLog([]);
    setValidEmails([]);
    setInvalidEmails([]);
    setStatus('');
    setError('');
    setLeadCount(0);
  };

  const handleFile = e => {
    const f = e.target.files[0];
    setFile(f);
    resetUI();
    setStatus('File ready.');
    if (f) {
      const reader = new FileReader();
      reader.onload = () => {
        const lines = reader.result.split('\n').filter(l => l.includes('@'));
        setLeadCount(lines.length);
      };
      reader.readAsText(f);
    }
  };

  const testProxy = async () => {
    try {
      const proxy = proxyText.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
      const r = await fetch(`${getGateway()}/test-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy })
      });
      const j = await r.json();
      setProxyTest(j.status || 'Unknown');
    } catch (e) {
      console.error(e);
      setProxyTest('Proxy connection failed');
    }
  };

  const startVerify = async () => {
    if (!file) return setError('Choose a CSV file first.');

    setVerifying(true);
    setError('');
    setStatus('Uploading & verifying…');

    const form = new FormData();
    form.append('file', file);
    form.append('proxy', proxyText.trim());

    try {
      const r = await fetch(`${getGateway()}/verify`, { method: 'POST', body: form });
      if (!r.ok || !r.body) throw new Error('Streaming failed');

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

      {/* Proxy input */}
      <div style={{ marginBottom: '1rem' }}>
        <label>SOCKS Proxies (one per line)<br /><small>Format: ip:port[:user:pass]</small></label><br />
        <textarea
          value={proxyText}
          onChange={e => setProxyText(e.target.value)}
          placeholder="123.123.123.123:1080\nuser:pass:proxy"
          rows={4}
          style={{ width: '100%' }}
        />
      </div>

      <button onClick={testProxy} style={{ marginBottom: '1rem' }}>🧪 Test First Proxy</button>
      {proxyTest && <p><strong>Proxy:</strong> {proxyTest}</p>}

      {/* Upload */}
      <input type="file" accept=".csv" onChange={handleFile} style={{ marginBottom: '1rem' }} /><br />
      {leadCount > 0 && <p><strong>Leads:</strong> {leadCount}</p>}

      <button onClick={startVerify} disabled={verifying}>
        {verifying ? 'Verifying…' : '✅ Start Verification'}
      </button>

      {status && <p><strong>Status:</strong> {status}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Logs */}
      {log.length > 0 && (
        <div style={{ marginTop: '1rem', maxHeight: 200, overflowY: 'auto' }}>
          <h3>Live Log</h3>
          <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}

      {/* Downloads */}
      {(validEmails.length || invalidEmails.length) && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Download Results</h3>
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
