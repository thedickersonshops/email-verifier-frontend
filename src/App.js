import React, { useState } from "react";
import axios from "axios";

const GATEWAYS = [
  "https://api1.thedickersonshops.online",
  "https://api2.thedickersonshops.online",
  "https://email-gateway-production-a491.up.railway.app"
];

const App = () => {
  const [file, setFile] = useState(null);
  const [proxy, setProxy] = useState("");
  const [results, setResults] = useState([]);
  const [emailCount, setEmailCount] = useState(null);
  const [uploadCount, setUploadCount] = useState(null);
  const [status, setStatus] = useState("Idle");

const handleFileChange = (e) => {
  const selectedFile = e.target.files[0];
  setFile(selectedFile);
  setUploadCount(null);
  setResults([]);
  setEmailCount(null);

  if (selectedFile) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const text = event.target.result;
      const emails = text.split(/\r?\n/).filter(line => line.includes('@'));
      setEmailCount(emails.length);
    };
    reader.readAsText(selectedFile);
  }
};

  const handleProxyChange = (e) => {
    setProxy(e.target.value);
  };

  const handleVerify = async () => {
    if (!file) return alert("Please upload a CSV file");

    const gateway = GATEWAYS[Math.floor(Math.random() * GATEWAYS.length)];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("proxy", proxy);

    setStatus("Uploading & verifying...");
    setResults([]);

    try {
      const response = await fetch(`${gateway}/verify`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Verification failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (let line of lines) {
          if (line.startsWith("data:")) {
            const payload = JSON.parse(line.replace("data: ", ""));
            if (payload.info) setUploadCount(payload.info);
            else setResults((prev) => [...prev, payload]);
          }
        }
      }

      setStatus("✅ Verification complete");
    } catch (err) {
      console.error(err);
      setStatus("❌ Verification failed");
    }
  };

  const handleProxyTest = async () => {
    const proxyToTest = proxy.trim().split("\n")[0];
    if (!proxyToTest) return alert("Enter a SOCKS5 proxy to test");

    const testURL = GATEWAYS[0];
    try {
      const res = await axios.post(`${testURL}/test-proxy`, { proxy: proxyToTest });
      alert(res.data.status);
    } catch (e) {
      alert("❌ Proxy test failed");
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>📧 Email Verifier</h1>

      <input type="file" onChange={handleFileChange} />

      <div style={{ marginTop: 10 }}>
        <textarea
          placeholder="SOCKS5 proxies in format: ip:port or ip:port:user:pass (1 per line)"
          rows={6}
          cols={60}
          value={proxy}
          onChange={handleProxyChange}
        ></textarea>
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={handleVerify}>🚀 Verify</button>
        <button onClick={handleProxyTest} style={{ marginLeft: 10 }}>🧪 Test Proxy</button>
      </div>

<div style={{ marginTop: 15 }}>
  <strong>Status:</strong> {status}<br />
  {emailCount !== null && (
    <div style={{ color: "green" }}>
      ✅ {emailCount} emails loaded ,Oyaa
    </div>
  )}
  {uploadCount && <div><strong>{uploadCount}</strong></div>}
</div>

      <div style={{ marginTop: 20 }}>
        <h3>📋 Results:</h3>
        <ul>
          {results.map((r, i) => (
            <li key={i}>{r.email} → {r.status}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default App;

