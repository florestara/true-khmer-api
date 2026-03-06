export type PresignAvatarUploadResponse = {
  uploadUrl: string;
  method: "PUT";
  requiredHeaders: {
    "Content-Length": string;
    "Content-Type": string;
  };
  avatarKey: string;
  publicUrl: string | null;
  expiresInSeconds: number;
};
