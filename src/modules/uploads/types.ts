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
  expiresInSeconds: number;
};

export type PresignVolunteerApplicationDocumentUploadResponse = {
  uploadUrl: string;
  method: "PUT";
  requiredHeaders: {
    "Content-Length": string;
    "Content-Type": string;
  };
  supportingDocument: {
    name: string;
    key: string;
  };
  expiresInSeconds: number;
};

export type PresignLaunchpadLogoUploadResponse = {
  uploadUrl: string;
  method: "PUT";
  requiredHeaders: {
    "Content-Length": string;
    "Content-Type": string;
  };
  logoImageKey: string;
  publicUrl: string | null;
  expiresInSeconds: number;
};

export type PresignLaunchpadCoverUploadResponse = {
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

export type PresignLaunchpadDocumentUploadResponse = {
  uploadUrl: string;
  method: "PUT";
  requiredHeaders: {
    "Content-Length": string;
    "Content-Type": string;
  };
  documentKey: string;
  publicUrl: string | null;
  expiresInSeconds: number;
};
