import path from "path";
import fs from "fs";
import multer from "multer";
import process from "node:process";

import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

// Restrict uploads to 5MB to avoid oversized files.
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Resolve a file extension from MIME type, falling back to the original name.
function resolveExtension(mimeType: string, originalName: string) {
  const fallback = path.extname(originalName);
  if (mimeType === "image/png") {
    return ".png";
  }
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  return fallback || ".jpg";
}

// Persist uploads under uploads/profiles/<userId> with a timestamped filename.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // Use the authenticated user id to isolate uploads per profile.
    const userId = req.user?.id ?? "unknown";
    const destinationPath = path.join(process.cwd(), "uploads", "profiles", userId);
    fs.mkdir(destinationPath, { recursive: true }, (err) => {
      cb(err ?? null, destinationPath);
    });
  },
  filename: (_req, file, cb) => {
    // Normalize to a safe extension and add a time-based suffix.
    const ext = resolveExtension(file.mimetype, file.originalname);
    const filename = `picture_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

export const uploadProfilePicture = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    // Accept only JPG/PNG to prevent unsupported file types.
    if (file.mimetype !== "image/jpeg" && file.mimetype !== "image/png") {
      cb(new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid file type", 400));
      return;
    }
    cb(null, true);
  }
});
