# Sickle Cell Advisor - Management Guide

This guide explains how to manage the Sickle Cell Advisor's knowledge and behavior without touching any code.

---

## 1. Adding New Medical Documents
To give the agent new information (like new research papers, care guides, or PDFs), follow these steps:

1.  **Open the Google Cloud Console**: Go to the [Cloud Storage Browser](https://console.cloud.google.com/storage/browser).
2.  **Select your Bucket**: Click on the bucket named `caregiver-corpus` (or the one configured for your project).
3.  **Upload Files**: 
    *   Drag and drop your PDF or Word documents directly into the browser window.
    *   Or click the **"Upload Files"** button at the top.
4.  **Automatic Processing**: Vertex AI Search will automatically detect these new files. 
    *   **Note**: It usually takes **15–30 minutes** for new documents to be indexed and "learned" by the agent.

---

## 2. Changing the Agent's Behavior (The Prompt)
If you want to change how the agent speaks, what it prioritizes, or add new "house rules," you can do so by editing a single text file.

1.  **Find the Prompt File**: In your Cloud Storage bucket, look for a folder named `config` and a file named `instructions.txt`.
2.  **Edit the File**:
    *   Click on `instructions.txt`.
    *   Click the **"Edit"** button at the top of the screen.
    *   Type your new instructions (e.g., "Always remind users to stay hydrated" or "Use a more casual tone").
3.  **Save**: Click **"Save"**.
4.  **Refresh**: The agent will pick up these new instructions automatically within a few minutes (or after a quick restart of the service).

---

## 3. Best Practices for Documents
*   **Format**: PDFs are the best format for medical documents.
*   **Clean Text**: Ensure the PDFs are not just "images of text" (they should be searchable/selectable).
*   **File Names**: Use clear, descriptive file names (e.g., `hydration-guide-2026.pdf` instead of `doc123.pdf`). This helps the agent cite its sources better.

---

## Troubleshooting
*   **Agent isn't using new info**: Wait at least 30 minutes for the search engine to finish indexing.
*   **Permission Errors**: Ensure you are logged in with your `@maryland.gov` account.
