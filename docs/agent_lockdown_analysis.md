# **SCD Advisor Agent Lockdown Analysis**

*Last updated: July 9, 2025*  
*M. Overturf*

The purpose of this document is to describe how ‘locked down’ the Gemini LLM is with respect to making errors, checking unauthorized sources, or using its training data to supersede data in the RAG corpus, for example. It is a technical document, but each section has a simplified introduction.

## **Acronym Definitions**

* **API**: Application Programming Interface  
* **CORS**: Cross-Origin Resource Sharing  
* **GCS**: Google Cloud Storage  
* **LLM**: Large Language Model  
* **RAG**: Retrieval-Augmented Generation  
* **SCD**: SCD Advisor Agent  
* **SSR**: Server-Side Rendering  
* **SSRF**: Server-Side Request Forgery  
* **WSS**: WebSocket Secure

## **1\. Is the GCS Bucket (the RAG Corpus) the Only Data Source?**

**Yes — but indirectly, via Vertex AI Search.** The data path is:

```
graph LR
    A["GCS Bucket<br/><b>caregivercorpus</b>"] --> B["Vertex AI Search<br/>Datastore<br/><b>caregiver-corpus_1782918777478</b>"]
    A --> E["System Prompt<br/><b>Rules/SCD Prompt .txt</b>"]
    A --> F["Greeting<br/><b>Rules/SCD Greeting.txt</b>"]
    E --> C["Gemini Model<br/><b>gemini-3.5-flash</b>"]
    F --> C
    B --> C
    C --> D["User Response"]
```

The agent uses **Vertex AI Search grounding** as its only retrieval tool. In [App.tsx:65-77](file:///Users/michaeloverturf/sca/sca-advisor/frontend/App.tsx#L65-L77), the chat session is created with a single tool — `vertexAiSearch` pointed at a specific datastore:

```ts
tools: [{
  retrieval: {
    vertexAiSearch: {
      datastore: datastorePath  // projects/.../dataStores/caregiver-corpus_1782918777478
    }
  }
}]
```

That datastore (`caregiver-corpus_1782918777478`) is backed by the `caregivercorpus` GCS bucket. **No other tools, data sources, or retrieval mechanisms are configured or accessible.**

### **GCS-Resident Configuration**

The system prompt and greeting are also sourced from the same GCS bucket — **not** from the codebase. The backend fetches them at runtime ([server.js:449-451](file:///Users/michaeloverturf/sca/sca-advisor/backend/server.js#L449-L451)):

```javascript
const INSTRUCTIONS_BUCKET = 'caregivercorpus'; 
const INSTRUCTIONS_PATH = 'Rules/SCD Prompt .txt';
const GREETING_PATH = 'Rules/SCD Greeting.txt';
```

This is a security advantage: the prompt cannot be altered via a code commit or frontend manipulation. Changes require GCS bucket write access.

The datastore ID (`caregiver-corpus_1782918777478`) and project ID (`gen-lang-client-0240369598`) are **hardcoded** in the frontend — they cannot be changed by user input.

## **2\. What Prevents the Agent from Reaching External HTTP Endpoints?**

THis is a conceivable situation where the agent goes off and queries other web pages, potentially contradicting or coming up with tangential or incorrect responses.  There are **multiple layers** of defense against this:

### **Layer 1: No Web-Access Tools Configured**

The Gemini model is given **exactly one tool** — `vertexAiSearch`. It has:

- ❌ No `googleSearch` (web search) tool  
- ❌ No `codeExecution` tool  
- ❌ No function calling that could make HTTP requests  
- ❌ No URL fetching capability

Without a tool that can reach the internet, the model simply **has no mechanism** to make HTTP calls. This is the strongest architectural guarantee.

### **Layer 2: System Prompt Grounding Rules**

The GCS-resident system instruction enforces corpus-only answers:

*"You must answer questions based ONLY in the provided caregiver corpus. If the answer is not there, say: 'I am sorry, I do not have that specific information.'"*

Additionally, every user message gets a runtime reinforcement appended in [App.tsx:111-112](file:///Users/michaeloverturf/sca/sca-advisor/frontend/App.tsx#L111-L112):

```ts
const strictReminder = "\n\n[STRICT REMINDER: Answer ONLY using the medical corpus. ...]";
```

Prompt-level restrictions are a **behavioral guideline**, not a hard technical barrier. They reduce drift but can theoretically be overcome with adversarial prompt injection. They should never be the sole defense — and in this case, they're not.

### **Layer 3: Backend Proxy SSRF Protection** 

The backend proxy in [server.js](file:///Users/michaeloverturf/sca/sca-advisor/backend/server.js) has a **hardcoded allowlist** of upstream hosts ([lines 225-227](file:///Users/michaeloverturf/sca/sca-advisor/backend/server.js#L225-L227)):

```javascript
const ALLOWED_UPSTREAM_HOSTS = new Set([
  "aiplatform.clients6.google.com",
]);
```

Every outbound API call is validated against this allowlist ([lines 339-349](file:///Users/michaeloverturf/sca/sca-advisor/backend/server.js#L339-L349)). If a constructed URL resolves to any host not in this set, the request is rejected with `400 Upstream host not allowed`.

### **Layer 4: Frontend Fetch Interceptor ✅ (Medium-Strong)**

The [proxy interceptor](file:///Users/michaeloverturf/sca/sca-advisor/frontend/vertex-ai-proxy-interceptor.js) validates URLs before proxying ([lines 14-49](file:///Users/michaeloverturf/sca/sca-advisor/frontend/vertex-ai-proxy-interceptor.js#L14-L49)):

```javascript
function isValidUrl(url) {
  const hostname = urlObj.hostname;
  if (!hostname.endsWith('aiplatform.googleapis.com')) {
    return false;  // Reject anything not Vertex AI
  }
  // Only allow specific API paths...
}
```

Non-matching requests fall through to the browser's native `fetch`, which would be subject to CORS policies but would **not** carry Google Cloud credentials.

### **Layer 5: WebSocket Target Validation ✅ (Strong)**

For live/streaming connections, the WebSocket proxy ([server.js:516-523](file:///Users/michaeloverturf/sca/sca-advisor/backend/server.js#L516-L523)) only accepts a **single hardcoded target URL**:

```javascript
if (targetUrl === 'wss://aiplatform.googleapis.com//ws/...BidiGenerateContent') {
  // Rewrite to regional endpoint
} else {
  socket.destroy();  // Reject everything else
  return;
}
```

## **3\. Training-Data Fallback Risk**

The model can answer from its general training knowledge even when grounding is configured.  This means that if, during trainin, the model ran across SCD or SCT data somewhere, it could, conceivably, dig that out and offer it as a response.  

The system prompt and per-turn reminder discourage this, but to provide stronger guarantees, the following hard code-level mechanisms are implemented.

### **Implemented Hardening Mechanisms**

#### **Mechanism A: A silent retry with grounding metadata gate**

Every grounded response includes `groundingMetadata` with `groundingChunks`. These are notations about how it derived a given answer.  If the model answers from training data instead of the corpus, this metadata will be absent or empty.

**How it works:** After a response finishes streaming, the application checks if `groundingChunks` were returned. If not, the application silently discards the ungrounded response and triggers a single, transparent retry.

On this retry, an aggressively strict instruction is appended to the user's prompt and sent back to the LLM:

*`[ADDITIONAL REMINDER: Your previous response did not cite the provided dataset. You MUST ground your answer in the provided dataset. Do not use outside knowledge.]`*

This prevents ungrounded answers from reaching the user without punishing them with error messages.

#### **Mechanism B: Temperature Configuration** 

‘Temperature’ is a behavior parameter for LLMs that helps determine how ‘wild’ they get in guess the next response word.  A temperature of 0 means it will always go with the likely/highest probability response.  The SCA-Advisor Gemini is set to 0.0.  This maximizes the determinism of the model, reducing its tendency to fabricate information or creatively extrapolate beyond the provided grounding data.

### **Future Considerations (not currently implemented)**

#### **Check Grounding API (High Impact, Higher Effort)**

A separate API endpoint (`discoveryengine.googleapis.com/.../checkGrounding`) that verifies a response against reference facts and returns a support score (0.0–1.0) and claim-level entailment. This provides the strongest verification but adds latency and cost. Currently not implemented, as the Grounding Metadata Gate provides sufficient coverage for most fallback scenarios.

## **Summary: Defense-in-Depth Assessment**

| Layer | Mechanism | Strength | Prevents |
| :---- | :---- | :---- | :---- |
| **Architecture** | Only `vertexAiSearch` tool configured | 🟢 Strong | Model has no mechanism to browse the web |
| **GCS-Resident Prompt** | System instructions stored in GCS bucket, not code | 🟢 Strong | Prompt cannot be altered via code or frontend |
| **System Prompt** | "Answer ONLY from corpus" instruction | 🟡 Medium | Discourages model from fabricating or using training data |
| **Runtime Prompt** | Strict reminder appended to every message | 🟡 Medium | Reinforces corpus-only behavior per-turn |
| **Temperature** | Set to `0.0` | 🟡 Medium | Reduces creative drift and hallucinations |
| **Grounding Gate** | Rejects responses missing `groundingChunks`, retries with stricter prompt | 🟢 Strong | Hard gate preventing ungrounded training-data answers |
| **Backend Proxy** | `ALLOWED_UPSTREAM_HOSTS` allowlist | 🟢 Strong | Blocks SSRF — credentials never sent to non-Google hosts |
| **Frontend Interceptor** | URL validation before proxying | 🟢 Medium-Strong | Only Vertex AI API URLs get proxied with auth |
| **WebSocket Guard** | Hardcoded target URL check | 🟢 Strong | Only `BidiGenerateContent` endpoint accepted |
| **Proxy Header** | `X-App-Proxy` shared secret | 🟢 Medium | Prevents direct calls to the proxy endpoint |

**The critical guarantee is architectural:** The Gemini LLM model  literally has no tool to make HTTP requests. The grounding gate ensures that if it attempts to answer from memory, the response is caught and rejected.

## **Open Gaps**

1. **There is no no server-side input validation**: User input is passed directly to the model. There is no server-side content filtering or input sanitization beyond the rate limiter.  In other words, whatever the user types in is presented to the LLM, and it is on its own.

   A sophisticated prompt injection by a hacker or bored person could try to override the system instructions (though without web tools, the blast radius is limited to corpus-bypassing answers, not data exfiltration).  

   Implementing a filter like this takes time and programming.

