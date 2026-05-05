import express from 'express';
import cors from 'cors';
import { ProxyAgent, fetch } from 'undici';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Прокси для обхода геоблока Gemini API.
// Креды задаются через PROXY_URL в .env (формат: http://user:pass@host:port).
// Если PROXY_URL не задан — запросы идут напрямую без прокси.
const PROXY_URL = process.env.PROXY_URL;
const proxyAgent = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

if (PROXY_URL) {
  console.log('Using proxy:', PROXY_URL.replace(/:[^@]+@/, ':****@'));
} else {
  console.log('No PROXY_URL set — direct connection to Gemini API');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', proxy: !!PROXY_URL });
});

app.post('/api/gemini/*', async (req, res) => {
  try {
    const geminiPath = req.params[0];
    const apiKey = req.query.key;
    const url = `https://generativelanguage.googleapis.com/v1beta/${geminiPath}?key=${apiKey}`;

    console.log('Proxying to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      ...(proxyAgent && { dispatcher: proxyAgent }),
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
