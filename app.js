const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

const app = express();

// Create uploads directory with error handling
try {
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
  }
} catch (error) {
  console.error('Failed to create uploads directory:', error.message);
}

// Configure multer with error handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      cb(null, 'uploads/');
    } catch (error) {
      console.error('Storage destination error:', error.message);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
      cb(null, filename);
    } catch (error) {
      console.error('Filename generation error:', error.message);
      cb(error);
    }
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1 // Only allow 1 file
  },
  fileFilter: (req, file, cb) => {
    try {
      const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        const error = new Error('Only image files are allowed!');
        error.code = 'INVALID_FILE_TYPE';
        return cb(error, false);
      }
    } catch (error) {
      console.error('File filter error:', error.message);
      cb(error, false);
    }
  }
});

// Helper function to run Python forgery detection with comprehensive error handling
async function detectImageForgery(imagePath) {
  return new Promise((resolve, reject) => {
    try {
      // Validate image path
      if (!imagePath || !fs.existsSync(imagePath)) {
        return reject(new Error('Image file not found'));
      }

      const scriptPath = path.join(__dirname, 'python', 'forgery_detector.py');

      // Check if Python script exists
      if (!fs.existsSync(scriptPath)) {
        return reject(new Error('Python forgery detection script not found'));
      }

      // Try different Python commands
      const pythonCommands = ['python3', 'python'];
      let currentCommand = 0;
      let lastError = null;

      function tryNextPython() {
        if (currentCommand >= pythonCommands.length) {
          return reject(new Error(`Python not available. Last error: ${lastError}`));
        }

        const pythonCommand = pythonCommands[currentCommand];
        console.log(`Trying Python command: ${pythonCommand}`);

        const pythonProcess = spawn(pythonCommand, [scriptPath, imagePath], {
          timeout: 30000, // 30 second timeout
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let isResolved = false;

        // Set timeout for the process
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            pythonProcess.kill('SIGTERM');
            reject(new Error('Python script execution timeout'));
          }
        }, 30000);

        pythonProcess.stdout.on('data', (data) => {
          try {
            stdout += data.toString();
          } catch (error) {
            console.error('Error reading Python stdout:', error.message);
          }
        });

        pythonProcess.stderr.on('data', (data) => {
          try {
            stderr += data.toString();
          } catch (error) {
            console.error('Error reading Python stderr:', error.message);
          }
        });

        pythonProcess.on('close', (code) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);

          if (code === 0) {
            try {
              if (!stdout.trim()) {
                return reject(new Error('Python script returned empty output'));
              }

              const result = JSON.parse(stdout);
              resolve(result);
            } catch (parseError) {
              console.error('Python output parsing error:', parseError.message);
              console.error('Raw Python output:', stdout);
              reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
          } else {
            lastError = `Exit code ${code}: ${stderr}`;
            console.log(`Python command ${pythonCommand} failed:`, lastError);
            currentCommand++;
            tryNextPython();
          }
        });

        pythonProcess.on('error', (error) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);

          lastError = error.message;
          console.log(`Python command ${pythonCommand} error:`, lastError);
          currentCommand++;
          tryNextPython();
        });
      }

      tryNextPython();

    } catch (error) {
      console.error('Error in detectImageForgery:', error.message);
      reject(error);
    }
  });
}

// Upload route with comprehensive error handling
app.post("/upload", (req, res) => {
  // Use multer with error handling
  upload.single("file")(req, res, async (multerError) => {
    try {
      // Handle multer errors
      if (multerError) {
        console.error('Multer error:', multerError.message);

        if (multerError.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: "error",
            message: "File too large. Maximum size is 10MB.",
            code: "FILE_TOO_LARGE"
          });
        }

        if (multerError.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({
            status: "error",
            message: "Invalid file type. Only image files are allowed.",
            code: "INVALID_FILE_TYPE"
          });
        }

        if (multerError.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            status: "error",
            message: "Too many files. Only one file is allowed.",
            code: "TOO_MANY_FILES"
          });
        }

        return res.status(400).json({
          status: "error",
          message: "File upload error",
          error: multerError.message,
          code: multerError.code || "UPLOAD_ERROR"
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          status: "error",
          message: "No file uploaded",
          code: "NO_FILE"
        });
      }

      const filePath = req.file.path;
      const fileName = req.file.filename;
      const originalName = req.file.originalname;
      const fileSize = req.file.size;

      // Validate file
      if (!filePath || !fileName || !originalName) {
        return res.status(400).json({
          status: "error",
          message: "Invalid file information",
          code: "INVALID_FILE_INFO"
        });
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(500).json({
          status: "error",
          message: "Uploaded file not found on server",
          code: "FILE_NOT_FOUND"
        });
      }

      console.log(`File uploaded successfully: ${originalName} -> ${fileName}`);
      console.log(`File path: ${filePath}, Size: ${fileSize} bytes`);

      // Try to perform forgery detection
      let forgeryResult = null;
      let analysisError = null;

      try {
        console.log('Starting forgery detection...');
        forgeryResult = await detectImageForgery(filePath);

        if (!forgeryResult || !forgeryResult.success) {
          analysisError = forgeryResult?.error || 'Unknown analysis error';
        }
      } catch (error) {
        console.error('Forgery detection failed:', error.message);
        analysisError = error.message;
      }

      // Prepare response
      const response = {
        status: "success",
        message: "File uploaded successfully",
        file: {
          originalName: originalName,
          fileName: fileName,
          path: filePath,
          size: fileSize,
          mimetype: req.file.mimetype
        }
      };

      // Add analysis results if available
      if (forgeryResult && forgeryResult.success) {
        response.message = "File uploaded and analyzed successfully";
        response.forgeryAnalysis = forgeryResult.analysis;
      } else {
        response.message = "File uploaded successfully (analysis not available)";
        response.forgeryAnalysis = {
          error: "Analysis not available",
          details: analysisError || "Python analysis failed"
        };
      }

      console.log('Upload completed successfully');
      res.json(response);

    } catch (error) {
      console.error('Unexpected error in upload handler:', error.message);
      console.error('Error stack:', error.stack);

      // Clean up uploaded file if it exists
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('Cleaned up uploaded file due to error');
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError.message);
        }
      }

      res.status(500).json({
        status: "error",
        message: "Internal server error during upload",
        error: error.message,
        code: "INTERNAL_ERROR"
      });
    }
  });
});

// Error handling middleware for unhandled errors
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error.message);
  console.error('Error stack:', error.stack);

  res.status(500).json({
    status: "error",
    message: "Internal server error",
    error: error.message,
    code: "UNHANDLED_ERROR"
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    console.error('Health check error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Test endpoint to check Python availability
app.get('/test-python', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, 'python', 'forgery_detector.py');

    if (!fs.existsSync(scriptPath)) {
      return res.json({
        success: false,
        message: 'Python forgery detection script not found',
        scriptPath: scriptPath
      });
    }

    // Test Python availability
    exec('python3 --version', (error, stdout, stderr) => {
      if (error) {
        exec('python --version', (error2, stdout2, stderr2) => {
          if (error2) {
            return res.json({
              success: false,
              message: 'Python is not available on this system',
              errors: [error.message, error2.message]
            });
          } else {
            res.json({
              success: true,
              message: 'Python is available',
              version: stdout2.trim(),
              command: 'python'
            });
          }
        });
      } else {
        res.json({
          success: true,
          message: 'Python is available',
          version: stdout.trim(),
          command: 'python3'
        });
      }
    });

  } catch (error) {
    console.error('Python test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Global error handlers to prevent process exit
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error('Error stack:', error.stack);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// Start server with error handling
const PORT = 8080;

try {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Python test: http://localhost:${PORT}/test-python`);
  });
} catch (error) {
  console.error('Failed to start server:', error.message);
  process.exit(1);
}