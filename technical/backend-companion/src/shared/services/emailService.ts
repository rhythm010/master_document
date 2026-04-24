import nodemailer from "nodemailer";

import { config } from "../config";
import { buildVerifyEmailLinks } from "../utils/urls";

// Shared SMTP transport for outbound email.
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

  await transporter.sendMail({
    from: config.emailFrom,
    to: input.to,
    subject: "Verify your Companion account",
    text
  });
}
