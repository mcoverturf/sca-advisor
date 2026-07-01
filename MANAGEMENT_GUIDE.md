# Sickle Cell Advisor - Management & Safety Guide

This guide explains how to manage the Sickle Cell Advisor's knowledge, behavior, and safety protocols.

---

## 1. Managing the Knowledge Corpus (Adding Documents)
To give the agent new medical information, follow these steps:

1.  **Open the Google Cloud Console**: Go to the [Cloud Storage Browser](https://console.cloud.google.com/storage/browser).
2.  **Select your Bucket**: Click on the bucket named `caregivercorpus`.
3.  **Upload Files**: 
    *   Drag and drop your PDF or Word documents directly into the browser window.
    *   **Note**: It takes **15–30 minutes** for new documents to be indexed and "learned" by the agent.

---

## 2. Managing Agent Behavior (The Prompt)
You can change the agent's "personality" or rules without touching any code:

1.  **Find the Instruction File**: In your bucket, go to the folder `config` and open `instructions.txt`.
2.  **Edit**: Click the **"Edit"** button. Type your new rules or instructions.
3.  **Save**: Click **"Save"**.
4.  **Update**: Users just need to **refresh their browser** to see the new behavior in their next chat.

---

## 3. Safety & Drift Protection (Built-in)
We have built "Anti-Drift" technology directly into the machine to protect distressed parents from false information:

*   **Internal Verification**: For every question, the agent is forced to "think" internally and verify the facts against the corpus before it speaks.
*   **Silent Reinforcements**: The system secretly reminds the AI of its strict safety rules on every single message cycle. This prevents the AI from "forgetting" its boundaries in long conversations.
*   **Emotional Guardrails**: If a user expresses distress or trickery, the agent is programmed to respond with bounded empathy and refocus on reliable medical facts.

---

## 4. Verifying Sources (Clickable Grounding)
The agent provides "Sources" at the bottom of its answers:
*   **Click to View**: You can click on any source to go directly to the original document in the Google Cloud Console.
*   **Transparency**: This allows you to verify exactly which page of which PDF the agent used for its answer.

---

## 5. Code Management & Deployment
If you need to move the code or update the service:

1.  **Source of Truth**: The latest working code is always in the GitHub repository: `mcoverturf/sca-advisor`.
2.  **Cloud Shell**: Open Cloud Shell and run `git pull` to get the latest version.
3.  **Deployment**: To push changes live to Cloud Run, run:
    ```bash
    gcloud run deploy sca-advisor --source . --region us-central1 --quiet
    ```

---

## Troubleshooting
*   **Permission Errors**: Ensure you are logged in with your `@maryland.gov` account.
*   **"I don't know" Answers**: This means the information is missing from the corpus. Simply upload the relevant PDF to the bucket to fix it.
