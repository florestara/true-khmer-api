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

export type PresignVolunteerCoverUploadResponse = {
  uploadUrl: string;
  method: "PUT";
  requiredHeaders: {
    "Content-Length": string;
    "Content-Type": string;
  };
  coverImageKey: string;
  publicUrl: string | null;
  expiresInSeconds: number;
};

export type PresignVolunteerApplicationDocumentUploadResponse = {
  uploadUrl: string;
  method: "PUT";
  requiredHeaders: {
    "Content-Length": string;
    "Content-Type": string;
  };
  supportingDocumentKey: string;
  expiresInSeconds: number;
};
