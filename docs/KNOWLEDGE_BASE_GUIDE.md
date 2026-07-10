# Updating the Sickle Cell Advisor's Knowledge Base

*A guide for content managers. No technical skills needed.*

## The one thing to remember

Uploading a document to the corpus folder does **not** automatically teach it to the Advisor. After you add, replace, or update documents, you must run the **Update Knowledge Base** step below. Until you do, the Advisor cannot see your new documents.

## How to update

1. Upload your PDF(s) to the corpus (the `caregivercorpus` storage folder), as you do today. Only PDF files placed at the top level are used — files inside subfolders are ignored.
2. Open the Advisor's admin page: **`<your app URL>/admin`**
3. Enter your access code and sign in.
4. **Step 1 — Check documents.** The page lists every document in the corpus. Green "Available" means the Advisor can use it. Red "NOT available yet" means it still needs an update.
5. **Step 2 — Update knowledge base.** Click the button and keep the page open. The update usually takes 5–15 minutes; the page will tell you when it is done.
6. After it finishes, allow up to 15 more minutes, then click **Check documents** again — everything should be green. Test the Advisor with a question about your new document.

## Good to know

- Running an update is always safe. It only adds or refreshes documents; it never breaks anything.
- Replacing a PDF with a new version (same file name) also requires an update afterward.
- **Removing** a document from the corpus does *not* remove it from the Advisor's knowledge. If you need a document fully removed, contact your technical support person.
- If the page reports failed documents or you see anything unexpected, contact your technical support person.

---

## For the administrator (technical notes)

- The admin page is served by the backend at `/admin` (file: `backend/admin.html`); API routes are `/api/admin/*` in `backend/server.js`.
- Set the `ADMIN_KEY` environment variable (in `.env.local` locally, and as an env var on the Cloud Run service) to a long random string; share it with the SME. If unset, all admin endpoints return 503.
- The import is `reconciliationMode: INCREMENTAL` over `gs://caregivercorpus/*.pdf` — deliberately excluding `Rules/` so the system prompt is never indexed as corpus content.
- Deletions from the bucket are not propagated (INCREMENTAL never deletes). To remove a document from the index, delete it via the Discovery Engine documents API or run a FULL reconciliation import.
- The Advisor's runtime service account needs `discoveryengine.documents.import/list/get` (e.g. roles/discoveryengine.editor) on the datastore project, plus storage read on the bucket (already required).
