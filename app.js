const express = require("express");
const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Configure multer to preserve file extensions and limit file size to 10MB
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Preserve original filename with extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: "error", message: "No file uploaded" });
  }

  const filePath = req.file.path;
  const fileName = req.file.filename;
  const originalName = req.file.originalname;

  console.log(`File uploaded: ${originalName} -> ${fileName}`);
  console.log(`File path: ${filePath}`);
  console.log(`File extension: ${path.extname(originalName)}`);
  console.log(`Full req.file object:`, req.file);
  res.json({ message: "ok" });
});

// Health check
app.get("/health", (req, res) => res.send("Node + Python Forgery Check API running"));

const PORT = 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
