const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api-proxy', async (req, res) => {
  try {
    const { model, contents, config, stream } = req.body;
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "API_KEY environment variable is not configured on the server." });
    }

    const isStreaming = !!stream;
    const action = isStreaming ? 'streamGenerateContent' : 'generateContent';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${apiKey}`;
    
    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contents, config })
    });

    const apiClient = {
      isStreaming: isStreaming,
      name: model
    };

    // 6. Respond to the client based on stream type
    if (apiClient.isStreaming) {
      console.log(`[Node Proxy] Sending STREAMING response for ${apiClient.name}`);
      
      // Dynamic content-type adjustment
      const contentType = apiResponse.headers.get('content-type') || 'application/json';
      
      res.writeHead(apiResponse.status, {
        'Content-Type': contentType,
        'Transfer-Encoding': 'chunked',
        'Connection': 'keep-alive',
      });
      // Immediately send headers
      res.flushHeaders();

      // Pipe the upstream stream directly to the client response
      apiResponse.body.on('data', (chunk) => {
        res.write(chunk);
      });

      apiResponse.body.on('end', () => {
        res.end();
      });

      apiResponse.body.on('error', (err) => {
        console.error('[Node Proxy] Stream error:', err);
        res.end();
      });
    } else {
      const data = await apiResponse.json();
      res.status(apiResponse.status).json(data);
    }
  } catch (error) {
    console.error('[Node Proxy] Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Node Proxy] Server running on port ${PORT}`);
});
