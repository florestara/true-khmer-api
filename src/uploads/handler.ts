import { createHmac, createHash, randomUUID } from "node:crypto";
import type { Context } from "hono";
import { getAuthUserId, type AuthPayload } from "../auth/types";
import type { PresignAvatarUploadPayload } from "./schema";
import type { PresignAvatarUploadResponse } from "./types";

const R2_REGION = "auto";
const PRESIGN_EXPIRY_SECONDS = 600;

function getUserId(c: Context) {
  const authPayload = c.get("auth") as AuthPayload | undefined;
  return getAuthUserId(authPayload);
}

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sha256Hex(value: string) {
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
  const baseName = fileName.split(/[/\\]/).pop() || "";
  const extension = baseName.includes(".")
    ? (baseName.split(".").pop() ?? "bin")
    : "bin";
  const safeExtension =
    extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `avatars/${userId}/${Date.now()}-${randomUUID()}.${safeExtension}`;
}

function resolvePublicUrl(avatarKey: string) {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!base) {
    return null;
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/${avatarKey}`;
}

function toSafeErrorLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: "unknown error",
  };
}

function buildPresignedPutUrl(
  avatarKey: string,
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

  const canonicalUri = `/${encodeRfc3986(bucketName)}/${avatarKey
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

export async function handlePresignAvatarUpload(
  c: Context,
  payload: PresignAvatarUploadPayload,
) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const avatarKey = buildAvatarKey(userId, payload.fileName);
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
    console.error(
      "Failed to generate avatar upload URL",
      toSafeErrorLog(error),
    );
    return c.json({ ok: false, error: "Failed to generate upload URL" }, 500);
  }
}
