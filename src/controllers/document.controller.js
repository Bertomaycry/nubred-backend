import { randomUUID } from "node:crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";
import { ensureStorage } from "../modules/project/storage/provider.js";
import { buildDocumentKey, keyBelongsToProject } from "../modules/project/storage/keys.js";
import {
  DOCUMENT_TYPES,
  validateUploadFile,
} from "../modules/project/storage/allowed.js";
import { isSectionKey } from "../modules/project/sections/registry.js";
import { enqueueJob } from "../modules/project/jobs/enqueue.js";
import { JOB_TYPES } from "../modules/project/jobs/types.js";

const PRESIGN_EXPIRES = Number.parseInt(
  process.env.NUBRED_PRESIGN_EXPIRES_SECONDS ?? "900",
  10
);

function serializeDocument(doc, extra = {}) {
  return {
    id: doc.id,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    documentType: doc.documentType,
    origin: doc.origin ?? "UPLOAD",
    sectionKey: doc.sectionKey ?? null,
    status: doc.status,
    failureReason: doc.failureReason,
    uploadedAt: doc.uploadedAt,
    createdAt: doc.createdAt,
    pageCount: extra.pageCount ?? doc.pages?.length ?? undefined,
  };
}

function parseDocumentType(value) {
  if (!value) return "OTHER";
  return DOCUMENT_TYPES.includes(value) ? value : "OTHER";
}

// @desc    Issue presigned PUT URLs and create PENDING_UPLOAD rows
// @route   POST /api/projects/:projectId/documents/init-upload
// @access  Private (VM)
export const initUpload = asyncHandler(async (req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Body must include a non-empty files array.",
    });
  }
  if (files.length > 20) {
    return res.status(400).json({
      success: false,
      message: "A maximum of 20 files can be initialised per request.",
    });
  }

  const validated = [];
  for (const file of files) {
    const check = validateUploadFile({
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
    });
    if (!check.ok) {
      return res.status(400).json({ success: false, message: check.message });
    }
    validated.push({
      filename: file.filename,
      mimeType: check.mimeType,
      size: file.size,
      documentType: parseDocumentType(file.documentType),
    });
  }

  const origin =
    req.body?.origin === "CHATBOT" || isSectionKey(req.params.sectionKey)
      ? "CHATBOT"
      : "UPLOAD";
  let chatbotSectionKey = null;
  if (origin === "CHATBOT") {
    const key = req.body?.sectionKey ?? req.params.sectionKey;
    if (!isSectionKey(key)) {
      return res.status(400).json({
        success: false,
        message:
          "Chatbot uploads require a valid sectionKey (contract, genotype, phase, protocol, or chronology).",
      });
    }
    chatbotSectionKey = key;
  }

  const storage = await ensureStorage();
  const created = [];

  await prisma.$transaction(async (tx) => {
    for (const file of validated) {
      const documentId = randomUUID();
      const storageKey = buildDocumentKey({
        tenantId: req.tenant.id,
        projectId: req.project.id,
        documentId,
        filename: file.filename,
      });

      const document = await tx.document.create({
        data: {
          id: documentId,
          tenantId: req.tenant.id,
          projectId: req.project.id,
          originalFilename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: file.size,
          storageKey,
          bucket: storage.bucket,
          documentType: file.documentType,
          origin,
          sectionKey: chatbotSectionKey,
          status: "PENDING_UPLOAD",
          uploadedById: req.user.id,
        },
      });

      created.push(document);
    }
  });

  const uploads = [];
  for (const document of created) {
    const presigned = await storage.getPresignedPutUrl({
      key: document.storageKey,
      mimeType: document.mimeType,
      expiresIn: Number.isFinite(PRESIGN_EXPIRES) ? PRESIGN_EXPIRES : 900,
    });
    uploads.push({
      document: serializeDocument(document),
      storageKey: document.storageKey,
      upload: presigned,
    });
  }

  res.status(201).json({
    success: true,
    message: "Presigned upload URLs issued. PUT each file, then call complete.",
    uploads,
  });
});

// @desc    Verify the object landed in storage and start text extraction
// @route   POST /api/projects/:projectId/documents/:documentId/complete
// @access  Private (VM)
export const completeUpload = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      projectId: req.project.id,
      tenantId: req.tenant.id,
    },
  });

  if (!document) {
    return res.status(404).json({ success: false, message: "Document not found." });
  }

  if (!keyBelongsToProject(document.storageKey, {
    tenantId: req.tenant.id,
    projectId: req.project.id,
  })) {
    return res.status(500).json({
      success: false,
      message: "Document storage key is invalid.",
    });
  }

  if (document.status !== "PENDING_UPLOAD" && document.status !== "FAILED") {
    return res.status(409).json({
      success: false,
      message: `Document is already ${document.status}.`,
      document: serializeDocument(document),
    });
  }

  const storage = await ensureStorage();
  const head = await storage.headObject(document.storageKey);

  if (!head.exists) {
    return res.status(400).json({
      success: false,
      message:
        "Object was not found in storage. PUT the file to the presigned URL, then retry complete.",
    });
  }

  if (head.sizeBytes != null && head.sizeBytes !== document.sizeBytes) {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        failureReason: `Size mismatch: declared ${document.sizeBytes} bytes, stored ${head.sizeBytes} bytes.`,
      },
    });
    return res.status(400).json({
      success: false,
      message: "Uploaded file size does not match the size declared at init-upload.",
    });
  }

  const checksum =
    typeof req.body?.checksumSha256 === "string"
      ? req.body.checksumSha256.toLowerCase()
      : null;

  const processing = await prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: document.id },
      data: {
        status: "PROCESSING",
        failureReason: null,
        uploadedAt: new Date(),
        checksumSha256: checksum,
      },
    });

    await enqueueJob(
      {
        type: JOB_TYPES.EXTRACT_TEXT,
        tenantId: document.tenantId,
        projectId: document.projectId,
        payload: { documentId: document.id },
      },
      tx
    );

    return updated;
  });

  res.status(202).json({
    success: true,
    message: "Upload verified. Text extraction is queued.",
    document: serializeDocument(processing),
  });
});

// @desc    List documents for a project
// @route   GET /api/projects/:projectId/documents
// @access  Private
export const listDocuments = asyncHandler(async (req, res) => {
  const documents = await prisma.document.findMany({
    where: { projectId: req.project.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pages: true } } },
  });

  res.status(200).json({
    success: true,
    count: documents.length,
    documents: documents.map((doc) =>
      serializeDocument(doc, { pageCount: doc._count.pages })
    ),
  });
});

// @desc    Get one document (including page text once READY)
// @route   GET /api/projects/:projectId/documents/:documentId
// @access  Private
export const getDocument = asyncHandler(async (req, res) => {
  const includeText = req.query.includeText === "true";
  const document = await prisma.document.findFirst({
    where: {
      id: req.params.documentId,
      projectId: req.project.id,
    },
    include: includeText
      ? { pages: { orderBy: { pageNumber: "asc" } } }
      : { _count: { select: { pages: true } } },
  });

  if (!document) {
    return res.status(404).json({ success: false, message: "Document not found." });
  }

  res.status(200).json({
    success: true,
    document: {
      ...serializeDocument(document, {
        pageCount: includeText ? document.pages.length : document._count.pages,
      }),
      pages: includeText ? document.pages : undefined,
    },
  });
});

// @desc    Presigned GET for authorised preview / download
// @route   GET /api/projects/:projectId/documents/:documentId/download
// @access  Private
export const downloadDocument = asyncHandler(async (req, res) => {
  const document = await prisma.document.findFirst({
    where: {
      id: req.params.documentId,
      projectId: req.project.id,
    },
  });

  if (!document) {
    return res.status(404).json({ success: false, message: "Document not found." });
  }

  if (document.status === "PENDING_UPLOAD") {
    return res.status(409).json({
      success: false,
      message: "File has not been uploaded yet.",
    });
  }

  const storage = await ensureStorage();
  const download = await storage.getPresignedGetUrl({
    key: document.storageKey,
    filename: document.originalFilename,
  });

  res.status(200).json({
    success: true,
    filename: document.originalFilename,
    mimeType: document.mimeType,
    download,
  });
});

// @desc    Delete document blob + DB row
// @route   DELETE /api/projects/:projectId/documents/:documentId
// @access  Private (VM)
export const deleteDocument = asyncHandler(async (req, res) => {
  const document = await prisma.document.findFirst({
    where: {
      id: req.params.documentId,
      projectId: req.project.id,
    },
  });

  if (!document) {
    return res.status(404).json({ success: false, message: "Document not found." });
  }

  const storage = await ensureStorage();
  try {
    await storage.deleteObject(document.storageKey);
  } catch (error) {
    console.warn(`Could not delete object ${document.storageKey}:`, error.message);
  }

  await prisma.document.delete({ where: { id: document.id } });

  res.status(200).json({
    success: true,
    message: "Document deleted.",
  });
});
