export type PresignAvatarUploadResponse = {
  uploadUrl: string;
  method: "PUT";
  requiredHeaders: {
    "Content-Type": string;
  };
  avatarKey: string;
  publicUrl: string | null;
  expiresInSeconds: number;
};
