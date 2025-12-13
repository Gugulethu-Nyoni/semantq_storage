import multer from 'multer';

/**
 * Create Express middleware for file uploads
 * @param {Object} options - Middleware options
 * @returns {Array} Express middleware array
 */
export function createUploadMiddleware(options = {}) {
  const {
    fields = [],
    maxFileSize = 50 * 1024 * 1024,
    maxFiles = 10
  } = options;
  
  // Configure multer
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    }
  });
  
  // If specific fields are provided, use .fields()
  if (Array.isArray(fields) && fields.length > 0) {
    const multerFields = fields.map(field => ({
      name: field,
      maxCount: options[field]?.maxCount || 1
    }));
    
    return [
      upload.fields(multerFields),
      (req, res, next) => {
        // Attach files to request in consistent format
        if (req.files) {
          req.uploadedFiles = req.files;
        }
        next();
      }
    ];
  }
  
  // Otherwise use single file upload
  return [
    upload.single('file'),
    (req, res, next) => {
      if (req.file) {
        req.uploadedFiles = { file: [req.file] };
      }
      next();
    }
  ];
}

// For backward compatibility
export default { createUploadMiddleware };