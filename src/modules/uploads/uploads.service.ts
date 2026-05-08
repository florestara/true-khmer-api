import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Context } from "hono";
import { getAuthUserId } from "../auth/utils/get-auth";
import type { PresignAvatarUploadPayload } from "./uploads.schema";
import type {
  PresignAvatarUploadResponse,
  PresignLaunchpadCoverUploadResponse,
  PresignLaunchpadDocumentUploadResponse,
  PresignLaunchpadLogoUploadResponse,
  PresignVolunteerApplicationDocumentUploadResponse,
  PresignVolunteerCoverUploadResponse,
} from "./types";

const R2_REGION = "auto";
const PRESIGN_EXPIRY_SECONDS = 600;

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function toAmzDate(date: Date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildAvatarKey(userId: string, fileName: string) {
  return buildNestedImageObjectKey("avatars", userId, fileName);
}

function buildVolunteerCoverKey(userId: string, contentType: string) {
  return buildNestedImageObjectKeyFromContentType(
    "volunteer-covers",
    userId,
    contentType,
  );
}

function buildLaunchpadLogoKey(userId: string, contentType: string) {
  return buildNestedImageObjectKeyFromContentType(
    "launchpad-logos",
    userId,
    contentType,
  );
}

function buildLaunchpadCoverKey(userId: string, contentType: string) {
  return buildNestedImageObjectKeyFromContentType(
    "launchpad-covers",
    userId,
    contentType,
  );
}

function buildVolunteerApplicationDocumentKey(
  opportunityId: string,
  applicantId: string,
) {
  return [
    "volunteer-applicant",
    "supporting-docs",
    opportunityId,
    applicantId,
    buildVolunteerApplicationDocumentFileName(),
  ].join("/");
}

function buildLaunchpadDocumentKey(userId: string) {
  return [
    "launchpad-document",
    userId,
    buildVolunteerApplicationDocumentFileName(),
  ].join("/");
}

function buildImageObjectFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop() || "";
  const extension = baseName.includes(".")
    ? (baseName.split(".").pop() ?? "bin")
    : "bin";
  const safeExtension =
    extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${Date.now()}-${randomUUID()}.${safeExtension}`;
}

function buildVolunteerApplicationDocumentFileName() {
  return `${randomUUID()}.pdf`;
}

function getImageExtensionFromContentType(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function buildNestedImageObjectKey(
  folder: string,
  resourceId: string,
  fileName: string,
) {
  return `${folder}/${resourceId}/${buildImageObjectFileName(fileName)}`;
}

function buildNestedImageObjectKeyFromContentType(
  folder: string,
  resourceId: string,
  contentType: string,
) {
  const extension = getImageExtensionFromContentType(contentType);
  return `${folder}/${resourceId}/${Date.now()}-${randomUUID()}.${extension}`;
}

function resolvePublicUrl(objectKey: string) {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!base) {
    return null;
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/${objectKey}`;
}

function buildPresignedPutUrl(
  objectKey: string,
  contentType: string,
  fileSize: number,
) {
  const accountId = getEnv("R2_ACCOUNT_ID");
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");
  const bucketName = getEnv("R2_BUCKET_NAME");

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const method = "PUT";
  const now = new Date();
  const { amzDate, dateStamp } = toAmzDate(now);
  const credentialScope = `${dateStamp}/${R2_REGION}/s3/aws4_request`;

  const canonicalUri = `/${encodeRfc3986(bucketName)}/${objectKey
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/")}`;

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(PRESIGN_EXPIRY_SECONDS),
    "X-Amz-SignedHeaders": "content-length;content-type;host",
  });

  const canonicalQueryString = Array.from(queryParams.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");

  const canonicalHeaders = `content-length:${fileSize}\ncontent-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = "content-length;content-type;host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, R2_REGION);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  const signedQuery = `${canonicalQueryString}&X-Amz-Signature=${signature}`;
  const uploadUrl = `https://${host}${canonicalUri}?${signedQuery}`;

  return {
    uploadUrl,
    requiredHeaders: {
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
    },
    expiresInSeconds: PRESIGN_EXPIRY_SECONDS,
  };
}

export function resolveR2PublicUrl(objectKey: string) {
  return resolvePublicUrl(objectKey);
}

export function presignVolunteerCoverUpload(options: {
  userId: string;
  contentType: string;
  fileSize: number;
}) {
  const coverImageKey = buildVolunteerCoverKey(
    options.userId,
    options.contentType,
  );
  const presigned = buildPresignedPutUrl(
    coverImageKey,
    options.contentType,
    options.fileSize,
  );

  const response: PresignVolunteerCoverUploadResponse = {
    uploadUrl: presigned.uploadUrl,
    method: "PUT",
    requiredHeaders: presigned.requiredHeaders,
    coverImageKey,
    expiresInSeconds: presigned.expiresInSeconds,
  };

  return response;
}

export function presignVolunteerApplicationDocumentUpload(options: {
  opportunityId: string;
  applicantId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}) {
  const supportingDocumentKey = buildVolunteerApplicationDocumentKey(
    options.opportunityId,
    options.applicantId,
  );
  const presigned = buildPresignedPutUrl(
    supportingDocumentKey,
    options.contentType,
    options.fileSize,
  );

  const response: PresignVolunteerApplicationDocumentUploadResponse = {
    uploadUrl: presigned.uploadUrl,
    method: "PUT",
    requiredHeaders: presigned.requiredHeaders,
    supportingDocument: {
      name: options.fileName,
      key: supportingDocumentKey,
    },
    expiresInSeconds: presigned.expiresInSeconds,
  };

  return response;
}

export async function handlePresignAvatarUpload(
  c: Context,
  payload: PresignAvatarUploadPayload,
) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const avatarKey = buildAvatarKey(authResult.userId, payload.fileName);
    const presigned = buildPresignedPutUrl(
      avatarKey,
      payload.contentType,
      payload.fileSize,
    );

    const response: PresignAvatarUploadResponse = {
      uploadUrl: presigned.uploadUrl,
      method: "PUT",
      requiredHeaders: presigned.requiredHeaders,
      avatarKey,
      publicUrl: resolvePublicUrl(avatarKey),
      expiresInSeconds: presigned.expiresInSeconds,
    };

    return c.json({ ok: true, upload: response });
  } catch (error) {
    console.error("Failed to generate avatar upload URL", error);
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}

export function presignLaunchpadLogoUpload(options: {
  userId: string;
  contentType: string;
  fileSize: number;
}) {
  const logoImageKey = buildLaunchpadLogoKey(
    options.userId,
    options.contentType,
  );
  const presigned = buildPresignedPutUrl(
    logoImageKey,
    options.contentType,
    options.fileSize,
  );

  const response: PresignLaunchpadLogoUploadResponse = {
    uploadUrl: presigned.uploadUrl,
    method: "PUT",
    requiredHeaders: presigned.requiredHeaders,
    logoImageKey,
    publicUrl: resolvePublicUrl(logoImageKey),
    expiresInSeconds: presigned.expiresInSeconds,
  };

  return response;
}

export function presignLaunchpadCoverUpload(options: {
  userId: string;
  contentType: string;
  fileSize: number;
}) {
  const coverImageKey = buildLaunchpadCoverKey(
    options.userId,
    options.contentType,
  );
  const presigned = buildPresignedPutUrl(
    coverImageKey,
    options.contentType,
    options.fileSize,
  );

  const response: PresignLaunchpadCoverUploadResponse = {
    uploadUrl: presigned.uploadUrl,
    method: "PUT",
    requiredHeaders: presigned.requiredHeaders,
    coverImageKey,
    publicUrl: resolvePublicUrl(coverImageKey),
    expiresInSeconds: presigned.expiresInSeconds,
  };

  return response;
}

export function presignLaunchpadDocumentUpload(options: {
  userId: string;
  contentType: string;
  fileSize: number;
}) {
  const documentKey = buildLaunchpadDocumentKey(options.userId);
  const presigned = buildPresignedPutUrl(
    documentKey,
    options.contentType,
    options.fileSize,
  );

  const response: PresignLaunchpadDocumentUploadResponse = {
    uploadUrl: presigned.uploadUrl,
    method: "PUT",
    requiredHeaders: presigned.requiredHeaders,
    documentKey,
    publicUrl: resolvePublicUrl(documentKey),
    expiresInSeconds: presigned.expiresInSeconds,
  };

  return response;
}
