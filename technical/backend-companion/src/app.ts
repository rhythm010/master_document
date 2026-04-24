import express from "express";
import path from "path";

import { identityRouter } from "./modules/identity";
import { companionProfileRouter } from "./modules/companion-profile";
import { errorHandler } from "./shared/middleware/errorHandler";

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(identityRouter);
app.use(companionProfileRouter);

app.use(errorHandler);
