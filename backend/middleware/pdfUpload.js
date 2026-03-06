// backend/middleware/pdfUpload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const TMP_DIR = path.join(__dirname, "..", "uploads", "tmp");
try {
  fs.mkdirSync(TMP_DIR, { recursive: true });
} catch {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TMP_DIR);
  },
  filename: function (req, file, cb) {
    const safe = String(file.originalname || "invoice.pdf")
      .replace(/[^\w.\-]+/g, "_")
      .slice(-120);
    cb(null, `${Date.now()}_${safe}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = String(path.extname(file.originalname || "")).toLowerCase();
  const ok = ext === ".pdf" || file.mimetype === "application/pdf";
  if (!ok) return cb(new Error("Only PDF allowed"));
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});
