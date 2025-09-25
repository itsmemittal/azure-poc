const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();

// Create uploads directory
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Helper function to run Python forgery detection
async function detectImageForgery(imagePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'python', 'forgery_detector.py');
    const pythonProcess = spawn('python3', [scriptPath, imagePath]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      } else {
        reject(new Error(`Python script failed: ${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
}

// Test endpoint to check Python availability
app.get('/test-python', async (req, res) => {
  try {
    // Create a test image path (you can use any existing image)
    const testImagePath = path.join(__dirname, 'uploads');

    // Check if Python can import required modules
    const pythonProcess = spawn('python3', ['-c', 'import cv2, numpy, PIL, skimage; print("All packages available")']);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          message: 'Python packages are available',
          output: stdout.trim()
        });
      } else {
        res.json({
          success: false,
          message: 'Python packages not available',
          error: stderr
        });
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload route with forgery detection
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No file uploaded"
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;

    console.log(`File uploaded: ${originalName} -> ${fileName}`);
    console.log(`File path: ${filePath}`);

    // Perform forgery detection
    console.log('Starting forgery detection...');
    const forgeryResult = await detectImageForgery(filePath);

    if (!forgeryResult.success) {
      return res.status(500).json({
        status: "error",
        message: "Forgery detection failed",
        error: forgeryResult.error
      });
    }

    // Prepare response
    const response = {
      status: "success",
      message: "File uploaded and analyzed successfully",
      file: {
        originalName: originalName,
        fileName: fileName,
        path: filePath,
        size: req.file.size
      },
      forgeryAnalysis: {
        isLikelyForged: forgeryResult.analysis.is_likely_forged,
        confidence: forgeryResult.analysis.confidence,
        overallScore: forgeryResult.analysis.overall_score,
        details: {
          ela: forgeryResult.analysis.ela,
          copyMove: forgeryResult.analysis.copy_move,
          noise: forgeryResult.analysis.noise,
          jpegArtifacts: forgeryResult.analysis.jpeg_artifacts,
          edgeConsistency: forgeryResult.analysis.edge_consistency
        }
      }
    };

    console.log('Forgery detection completed:', response.forgeryAnalysis);
    res.json(response);

  } catch (error) {
    console.error('Upload or analysis error:', error);
    res.status(500).json({
      status: "error",
      message: "Upload or analysis failed",
      error: error.message
    });
  }
});

// Route to analyze existing uploaded file
app.post("/analyze/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join('uploads', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: "error",
        message: "File not found"
      });
    }

    const forgeryResult = await detectImageForgery(filePath);

    if (!forgeryResult.success) {
      return res.status(500).json({
        status: "error",
        message: "Analysis failed",
        error: forgeryResult.error
      });
    }

    res.json({
      status: "success",
      message: "Analysis completed",
      forgeryAnalysis: forgeryResult.analysis
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Analysis failed",
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Python test: http://localhost:${PORT}/test-python`);
});