import { config } from "../config";

// Build app and web verification links for email content.
export function buildVerifyEmailLinks(token: string) {
  const deepLink = `companion://auth/verify-email?token=${token}`;
  const webLink = config.webVerifyUrl.replace("{token}", token);
  return { deepLink, webLink };
}

// Convert a relative path into a full public URL.
export function buildPublicUrl(path: string) {
  const base = config.publicBaseUrl.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
