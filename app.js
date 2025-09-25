const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();

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

// POST /upload endpoint
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

  // Check if file is PDF for forgery detection
  const isPdf = originalName.toLowerCase().endsWith('.pdf');
  const pythonScript = isPdf ? 'pdf_forgery_detector.py' : 'file_processor.py';

  // Python script path
  const pythonScriptPath = path.join(__dirname, "python", pythonScript);

  // Spawn Python process
  const python = spawn("python3", [pythonScriptPath, fileName, filePath]);
  res.json({ message: "ok" });
  return
  let output = "";
  let errorOutput = "";

  python.stdout.on("data", (data) => {
    output += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
    console.error(`Python error: ${data}`);
  });

  python.on("close", (code) => {
    // Remove uploaded file after processing
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      }
    });

    if (code !== 0) {
      return res.status(500).json({ 
        status: "error", 
        message: "Python script execution failed",
        error: errorOutput,
        fileName: fileName
      });
    }

    try {
      // Try to parse JSON output
      const result = JSON.parse(output.trim());
      res.json({
        status: "success",
        message: isPdf ? "PDF forgery analysis completed" : "File processed successfully",
        fileName: fileName,
        originalName: originalName,
        analysisType: isPdf ? "PDF Forgery Detection" : "General File Processing",
        result: result
      });
    } catch (parseError) {
      // If not JSON, return raw output
      res.json({
        status: "success",
        message: "File processed",
        fileName: fileName,
        originalName: originalName,
        output: output.trim()
      });
    }
  });
});

// Health check
app.get("/", (req, res) => res.send("Node + Python Forgery Check API running"));

// Test endpoint to check multer configuration
app.get("/test-multer", (req, res) => {
  res.json({
    message: "Multer configuration test",
    storage: "diskStorage configured",
    filename: "Preserves extensions with unique suffix",
    example: "file-1234567890-123456789.pdf"
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
