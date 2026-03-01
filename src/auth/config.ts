function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const authConfig = {
  appName: optionalEnv("APP_NAME", "True Khmer"),
  otpTtlMinutes: 5,
  betterAuthUrl: requireEnv("BETTER_AUTH_URL"),
  betterAuthSecret: requireEnv("BETTER_AUTH_SECRET"),
  resendApiKey: requireEnv("RESEND_API_KEY"),
  resendFrom: requireEnv("RESEND_FROM_EMAIL"),
};
