import { config } from "../config";

// Build app and web verification links for email content.
export function buildVerifyEmailLinks(token: string) {
  const encodedToken = encodeURIComponent(token);

  if (!config.webVerifyUrl.includes("{token}")) {
    throw new Error("WEB_VERIFY_URL must contain the '{token}' placeholder");
  }

  const deepLink = `${config.mobileDeepLinkScheme}auth/verify-email?token=${encodedToken}`;
  const webLink = config.webVerifyUrl.replaceAll("{token}", encodedToken);
  return { deepLink, webLink };
}

// Convert a relative path into a full public URL.
export function buildPublicUrl(path: string) {
  const base = config.publicBaseUrl.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
