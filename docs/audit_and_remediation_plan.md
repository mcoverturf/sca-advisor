# Codebase Security, Performance, and Resource Audit

This document details the findings of the architectural audit conducted on the Sickle Cell Advisor codebase, focusing on resource management, performance bottlenecks, and security exposures.

---

## Audit Results Summary

| Defect ID | Description | Component | Severity | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-001** | Streaming Resource Leak on Client Disconnect | Backend (`server.js`) | **Medium-High** | Unnecessary API costs & CPU exhaustion |
| **AUD-002** | Latency and Quota Abuse via Synchronous GCS Fetching | Backend (`server.js`) | **Medium** | Poor user experience (lag) & GCS API quota drain |
| **AUD-003** | Missing Rate Limiting on Configuration Endpoints | Backend (`server.js`) | **Medium** | Denial of Service (DoS) vulnerability |
| **AUD-004** | Fetch Interceptor Compatibility Bug | Frontend (`vertex-ai-proxy-interceptor.js`) | **Low** | Technical debt / Future SDK breakage risk |

---

## Individual Defect Characteristics & Remediation Plan

### AUD-001: Streaming Resource Leak on Client Disconnect

#### Characteristics
*   **Location**: [server.js](file:///Users/michaeloverturf/sca/sca-advisor/backend/server.js#L357-L421) inside `/api-proxy` streaming response block.
*   **Trigger**: A client closes their browser tab, navigates away, or refreshes the page while the model is actively streaming back a long answer.
*   **Behavior**: The TCP connection to the user terminates, but the Node.js process continues to download and process data from the Google Vertex AI API stream until it completes.
*   **Risk**: Wasted Vertex AI API tokens, billing costs for unused output, and CPU cycles on the Node.js server.

#### Proposed Amelioration
We will attach an event listener to the Express response `close` event. If the client disconnects before the stream is finished, we will destroy the upstream Vertex AI response body stream.

**Proposed Code Change:**
```javascript
// Inside server.js within the API stream handler:
res.on('close', () => {
  if (apiResponse.body && typeof apiResponse.body.destroy === 'function') {
    console.log(`[Node Proxy] Client disconnected prematurely. Aborting upstream stream.`);
    apiResponse.body.destroy();
  }
});
```

---

### AUD-002: Latency and Quota Abuse via Synchronous GCS Fetching

#### Characteristics
*   **Location**: [server.js](file:///Users/michaeloverturf/sca/sca-advisor/backend/server.js#L454-L494) inside `/api/config/instructions` handler.
*   **Trigger**: A user loads the app, causing the React app to initialize and request the configuration rules.
*   **Behavior**: The server performs synchronous Cloud Storage network calls (`exists()` and `download()`) on *every single request* to fetch `SCD Prompt .txt` and `SCD Greeting.txt`.
*   **Risk**:
    1.  **High Latency**: GCS roundtrips add 300ms–800ms to the chat initial connection time.
    2.  **Quota Drain**: High concurrent user counts will quickly exhaust GCS Class A/B request limits, resulting in high costs or API throttles.

#### Proposed Amelioration
Implement a lightweight **in-memory Cache-Aside pattern** with a Time-To-Live (TTL) of 5 minutes. The server will serve from memory and only query GCS when the cache expires or is empty.

**Proposed Code Change:**
```javascript
// In-memory cache store
let configCache = {
  data: null,
  expiresAt: 0
};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

app.get('/api/config/instructions', async (req, res) => {
  const now = Date.now();
  if (configCache.data && now < configCache.expiresAt) {
    return res.json(configCache.data);
  }

  try {
    const bucket = storage.bucket(INSTRUCTIONS_BUCKET);
    // ... Fetch from GCS as usual ...
    
    const configData = { instructions, greeting };
    configCache = {
      data: configData,
      expiresAt: now + CACHE_TTL_MS
    };

    res.json(configData);
  } catch (error) {
    // Return stale cache if error, otherwise empty config
    res.json(configCache.data || { instructions: null, greeting: null });
  }
});
```

---

### AUD-003: Missing Rate Limiting on Configuration Endpoints

#### Characteristics
*   **Location**: [server.js](file:///Users/michaeloverturf/sca/sca-advisor/backend/server.js#L454-L494).
*   **Trigger**: A malicious client scripts rapid repeated requests directly to the unprotected `/api/config/instructions` route.
*   **Behavior**: The backend processes every request, triggering consecutive external network calls (especially when cache expires or is not yet implemented).
*   **Risk**: CPU exhaustion, server slowdown, and Cloud Storage billing spikes (Denial of Service).

#### Proposed Amelioration
Apply the existing `proxyLimiter` (or a dedicated configuration-specific limiter) to the `/api/config/instructions` endpoint to limit abusers.

**Proposed Code Change:**
```javascript
// Apply the rate limiter to protect the config route
app.use('/api/config/instructions', proxyLimiter);
```

---

### AUD-004 (Bonus): Fetch Interceptor Compatibility Bug

#### Characteristics
*   **Location**: [vertex-ai-proxy-interceptor.js](file:///Users/michaeloverturf/sca/sca-advisor/frontend/vertex-ai-proxy-interceptor.js#L85-L92).
*   **Trigger**: The frontend or SDK executes a fetch using a native `Request` object instead of a URL string.
*   **Behavior**: The interceptor attempts to read `options.headers` which does not exist on a bare `fetch(request)` call (headers are properties of the `Request` object itself).
*   **Risk**: Strips authorization headers and payload body, causing communication with the proxy to fail. Currently latent, but will cause immediate breakage if the Google GenAI SDK updates its internal fetch strategy.

#### Proposed Amelioration
Normalize requests inside the interceptor to safely extract headers and body from both `options` and native `Request` objects.
