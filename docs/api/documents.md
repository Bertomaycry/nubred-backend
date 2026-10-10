POST /api/projects/:projectId/documents/init-upload
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
  Body (application/json):
    {
      "files": [
        {
          "filename": string,          // required, including extension
          "mimeType": string,          // required; empty string is ok if extension is valid
          "size": number,              // required; File.size in bytes; must be > 0
          "documentType": string       // optional; see DocumentType enum; default OTHER
        }
      ],
      "origin": "UPLOAD" | "CHATBOT",  // optional; default UPLOAD
      "sectionKey": string             // required when origin is CHATBOT
    }

  Constraints:
    files.length  1–20
    size          1 … 52428800 (50 MB) per file
    types         PDF, DOCX, XLSX, XLS, TXT, CSV, EML

Response 201:
  {
    "success": true,
    "message": "Presigned upload URLs issued. PUT each file, then call complete.",
    "uploads": [
      {
        "document": {
          "id": string,
          "originalFilename": string,
          "mimeType": string,
          "sizeBytes": number,
          "documentType": string,
          "origin": "UPLOAD" | "CHATBOT",
          "sectionKey": string | null,
          "status": "PENDING_UPLOAD",
          "failureReason": null,
          "uploadedAt": null,
          "createdAt": string
        },
        "storageKey": string,          // internal; do not display; do not PUT using this path yourself
        "upload": {
          "url": string,               // presigned MinIO/S3 URL — PUT the file HERE
          "method": "PUT",
          "headers": {
            "Content-Type": string     // must be sent unchanged on the PUT
          },
          "expiresIn": number          // seconds, default 900
        }
      }
    ]
  }

Errors:
  400 { "success": false, "message": "Body must include a non-empty files array." }
  400 { "success": false, "message": "A maximum of 20 files can be initialised per request." }
  400 { "success": false, "message": "Each file must include a filename." }
  400 { "success": false, "message": "\"<filename>\" is not an allowed type. Accepted: PDF, DOCX, XLSX, XLS, TXT, CSV, EML. Convert .doc files to .docx." }
  400 { "success": false, "message": "\"<filename>\" is missing a valid size." }
  400 { "success": false, "message": "\"<filename>\" exceeds the 50 MB upload limit." }
  401 unauthorized
  403 { "success": false, "message": "You are not a member of this organisation." }
  403 { "success": false, "message": "Only the Variety Manager can upload or delete project documents." }
  404 { "success": false, "message": "Project not found." }

Notes:
  - This call does NOT accept multipart/form-data and does NOT receive file bytes.
  - One request per user action: if the user drops 5 files, send all 5 in files[]. If they later click upload with 1 file, call this again with files.length === 1. Same projectId. Batches are independent.
  - Preserve array order: uploads[i] corresponds to request files[i]. Match by index when pairing File objects to presigned URLs.
  - document.id is required for complete. Persist it immediately.
  - Invalid documentType is silently stored as OTHER — do not treat that as an error.
  - Editor only: project creator or ACTIVE VARIETY_MANAGER.
  - Chatbot attachments (missing-field files): set origin CHATBOT + sectionKey, or use
    POST /api/projects/:projectId/sections/:sectionKey/chat/documents/init-upload.
    Those files are extracted for text but excluded from full-section re-extraction.
    See docs/api/chat.md.


PUT <upload.url>   (MinIO / object storage — NOT the NuBred API)
-------------------------------
Request:
  Auth: none (URL is signed)
  Method: PUT
  Headers: exactly upload.headers from init-upload
    Content-Type: <same mimeType used in init-upload>
  Body: raw file bytes (the File / Blob)

Response:
  200 from MinIO/S3 (empty or XML/ETag — ignore body)

Errors:
  CORS failure in the browser   // frontend origin not allowed on the bucket
  403 signature mismatch        // Content-Type header differs from init-upload mimeType
  403 / expired URL             // completed after expiresIn seconds

Notes:
  - Target host is typically http://localhost:9000 in local MiniO, not :8080.
  - Do not send Authorization, X-Tenant-Slug, or cookies.
  - fetch example:

      await fetch(upload.url, {
        method: "PUT",
        headers: upload.headers,
        body: file
      });

  - Run PUTs in parallel for a multi-file drop.
  - Only call complete after this PUT returns 2xx.


POST /api/projects/:projectId/documents/:documentId/complete
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
    documentId: string                 // from init-upload response
  Body (application/json, optional):
    {
      "checksumSha256": string         // optional; lowercase hex of file contents
    }

Response 202:
  {
    "success": true,
    "message": "Upload verified. Text extraction is queued.",
    "document": {
      "id": string,
      "originalFilename": string,
      "mimeType": string,
      "sizeBytes": number,
      "documentType": string,
      "status": "PROCESSING",
      "failureReason": null,
      "uploadedAt": string,
      "createdAt": string
    }
  }

Errors:
  400 { "success": false, "message": "Object was not found in storage. PUT the file to the presigned URL, then retry complete." }
  400 { "success": false, "message": "Uploaded file size does not match the size declared at init-upload." }
  401 unauthorized
  403 editor-only (same messages as init-upload)
  404 { "success": false, "message": "Document not found." }
  409 {
        "success": false,
        "message": "Document is already PROCESSING." | "Document is already READY." | ...,
        "document": { ...serialized document }
      }
  500 { "success": false, "message": "Document storage key is invalid." }

Notes:
  - One complete per document. There is no batch-complete endpoint.
  - Backend HEADs the object in storage. If the PUT never happened, you get 400 — retry PUT then complete, do not skip PUT.
  - Size mismatch: document is marked FAILED. User must delete and re-init, or you may retry complete only if you re-PUT the exact declared size (complete is allowed again from FAILED).
  - 409 if status is already PROCESSING or READY — treat as success for the UI if status is READY/PROCESSING; do not re-PUT.
  - complete is allowed from PENDING_UPLOAD and FAILED only.
  - Extraction is async via the Postgres job queue. 202 does not mean READY — it means an EXTRACT_TEXT job was inserted. Poll GET document until READY or FAILED.
  - While retries are in progress the document stays PROCESSING. After 3 failed attempts it becomes FAILED with failureReason.
  - checksumSha256 is optional; if omitted the server hashes after download.


GET /api/projects/:projectId/documents
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string

Response 200:
  {
    "success": true,
    "count": number,
    "documents": [
      {
        "id": string,
        "originalFilename": string,
        "mimeType": string,
        "sizeBytes": number,
        "documentType": string,
        "status": "PENDING_UPLOAD" | "PROCESSING" | "READY" | "FAILED",
        "failureReason": string | null,
        "uploadedAt": string | null,
        "createdAt": string,
        "pageCount": number
      }
    ]
  }

Errors:
  401 unauthorized
  403 { "success": false, "message": "You are not a member of this organisation." }
  403 { "success": false, "message": "You do not have access to this project." }
  404 { "success": false, "message": "Project not found." }

Notes:
  - Newest first (createdAt desc).
  - pageCount is 0 until status is READY (or if extraction produced no pages).
  - Viewer access: creator or ACTIVE project member.
  - Use this as the source of truth for the project’s file list after each upload round.


GET /api/projects/:projectId/documents/:documentId
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
    documentId: string
  Query:
    includeText: "true" | omitted      // optional; default false

Response 200 (includeText omitted):
  {
    "success": true,
    "document": {
      "id": string,
      "originalFilename": string,
      "mimeType": string,
      "sizeBytes": number,
      "documentType": string,
      "status": string,
      "failureReason": string | null,
      "uploadedAt": string | null,
      "createdAt": string,
      "pageCount": number
    }
  }

Response 200 (includeText=true):
  {
    "success": true,
    "document": {
      "id": string,
      "originalFilename": string,
      "mimeType": string,
      "sizeBytes": number,
      "documentType": string,
      "status": string,
      "failureReason": string | null,
      "uploadedAt": string | null,
      "createdAt": string,
      "pageCount": number,
      "pages": [
        {
          "id": string,
          "documentId": string,
          "pageNumber": number,        // 1-based
          "text": string,
          "charCount": number,
          "createdAt": string,
          "updatedAt": string
        }
      ]
    }
  }

Errors:
  401 unauthorized
  403 viewer-only
  404 { "success": false, "message": "Document not found." }

Notes:
  - Poll this after complete (without includeText) until status is READY or FAILED.
  - Suggested poll: every 1–2s, stop on READY or FAILED. Extraction for a typical PDF is seconds, not minutes.
  - Only request includeText=true after READY. Before READY, pages is empty.
  - PDF → one page object per PDF page. DOCX → usually a single page. Spreadsheet → one page per worksheet.
  - FAILED: show failureReason. User can delete the document and upload again.


GET /api/projects/:projectId/documents/:documentId/download
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
    documentId: string

Response 200:
  {
    "success": true,
    "filename": string,
    "mimeType": string,
    "download": {
      "url": string,                   // presigned GET — open or fetch this
      "method": "GET",
      "expiresIn": number
    }
  }

Errors:
  401 unauthorized
  403 viewer-only
  404 { "success": false, "message": "Document not found." }
  409 { "success": false, "message": "File has not been uploaded yet." }

Notes:
  - 409 when status is still PENDING_UPLOAD (PUT never completed).
  - download.url is a short-lived MinIO/S3 GET. Do not send Clerk auth to it.
  - Use for in-app preview or “download original”. Content-Disposition is inline.


DELETE /api/projects/:projectId/documents/:documentId
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
    documentId: string

Response 200:
  {
    "success": true,
    "message": "Document deleted."
  }

Errors:
  401 unauthorized
  403 { "success": false, "message": "Only the Variety Manager can upload or delete project documents." }
  404 { "success": false, "message": "Document not found." }

Notes:
  - Editor only (creator or ACTIVE VARIETY_MANAGER).
  - Deletes the storage object (best-effort) and the DB row (pages cascade).
  - Safe to call on PENDING_UPLOAD (abandoned init), FAILED, PROCESSING, or READY.
  - After delete, refresh the document list.


Frontend upload helper (reference)
----------------------------------
  async function uploadFiles(projectId, fileList, { token, tenantSlug, documentType } = {}) {
    const files = Array.from(fileList);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Tenant-Slug": tenantSlug || "dev",
    };

    const initRes = await fetch(`/api/projects/${projectId}/documents/init-upload`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        files: files.map((f) => ({
          filename: f.name,
          mimeType: f.type,
          size: f.size,
          documentType: documentType || "OTHER",
        })),
      }),
    });
    const initJson = await initRes.json();
    if (!initRes.ok) throw new Error(initJson.message || "init-upload failed");

    await Promise.all(
      initJson.uploads.map(async (item, i) => {
        const put = await fetch(item.upload.url, {
          method: item.upload.method,       // "PUT"
          headers: item.upload.headers,     // { "Content-Type": ... }
          body: files[i],
        });
        if (!put.ok) throw new Error(`PUT failed for ${files[i].name}`);

        const completeRes = await fetch(
          `/api/projects/${projectId}/documents/${item.document.id}/complete`,
          { method: "POST", headers, body: JSON.stringify({}) }
        );
        const completeJson = await completeRes.json();
        if (!completeRes.ok) throw new Error(completeJson.message || "complete failed");
      })
    );

    // Then poll GET .../documents/:id until READY | FAILED for each document.id
  }

Notes:
  - Replace `/api` with the backend origin in local (http://localhost:8080/api) unless you proxy.
  - If Vite proxy is used, keep relative `/api` and proxy to :8080; MinIO PUT still goes to the absolute upload.url (localhost:9000) and must not be proxied through Vite.
