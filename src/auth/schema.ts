export type Gender = "male" | "female" | "other";

export type AuthRegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gender: Gender;
};

export type AuthVerifyRegisterOtpPayload = {
  email: string;
  otp: string;
};

export type AuthLoginPayload = {
  email: string;
  password: string;
};

export type AuthRefreshPayload = {
  refreshToken: string;
  email: string;
};
