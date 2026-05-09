import nodemailer from "nodemailer";

import { config } from "../config";
import { logger } from "../logger";
import { buildVerifyEmailLinks } from "../utils/urls";

// Shared SMTP transport for outbound email (used only when EMAIL_DELIVERY_MODE=smtp).
const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined
});

// Send an account verification email with deep link and web link variants.
export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  token: string;
}) {
  // Build both app and web verification links for the message body.
  const { deepLink, webLink } = buildVerifyEmailLinks(input.token);
  const subject = "Verify your Companion account";
  const text = [
    `Hi ${input.name},`,
    "",
    "Welcome to Companion! Please verify your email address by tapping the link below:",
    "",
    deepLink,
    "",
    `Or copy and paste this link: ${webLink}`,
    "",
    "This link expires in 24 hours.",
    "",
    "If you didn't create this account, please ignore this email."
  ].join("\n");

  if (config.emailDeliveryMode === "disabled") {
    logger.warn(
      { to: input.to, subject, emailDeliveryMode: config.emailDeliveryMode },
      "email delivery disabled"
    );
    return;
  }

  if (config.emailDeliveryMode === "log_only") {
    const encodedToken = encodeURIComponent(input.token);
    const redactedText = text
      .replaceAll(input.token, "[REDACTED]")
      .replaceAll(encodedToken, "[REDACTED]");

    logger.info(
      {
        to: input.to,
        subject,
        emailDeliveryMode: config.emailDeliveryMode,
        rendered: { from: config.emailFrom, text: redactedText }
      },
      "email delivery log_only"
    );
    return;
  }

  await transporter.sendMail({
    from: config.emailFrom,
    to: input.to,
    subject,
    text
  });
}
