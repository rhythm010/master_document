import { config } from "../config";

export function buildVerifyEmailLinks(token: string) {
  const deepLink = `companion://auth/verify-email?token=${token}`;
  const webLink = config.webVerifyUrl.replace("{token}", token);
  return { deepLink, webLink };
}

export function buildPublicUrl(path: string) {
  const base = config.publicBaseUrl.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
