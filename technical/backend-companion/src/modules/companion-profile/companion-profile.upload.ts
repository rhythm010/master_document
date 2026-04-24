import path from "path";
import fs from "fs";
import multer from "multer";

import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.user?.id ?? "unknown";
    const destinationPath = path.join(process.cwd(), "uploads", "profiles", userId);
    fs.mkdir(destinationPath, { recursive: true }, (err) => {
      cb(err ?? null, destinationPath);
    });
  },
  filename: (_req, file, cb) => {
    const ext = resolveExtension(file.mimetype, file.originalname);
    const filename = `picture_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

export const uploadProfilePicture = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "image/jpeg" && file.mimetype !== "image/png") {
      cb(new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid file type", 400));
      return;
    }
    cb(null, true);
  }
});
