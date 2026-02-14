import multer from 'multer';
import { validateFile, parseSize, expandCategories } from './utils.js';

/**
 * Create Express middleware for file uploads
 * @param {Object} options - Middleware options
 * @returns {Array} Express middleware array
 */
export function createUploadMiddleware(options = {}) {
  const {
    fields = [],
    maxFileSize = '50MB',
    maxFiles = 10,
    fieldName = 'file', // Default field name
    multiple = false,    // Multiple files in same field
    allowedTypes = [],
    allowedCategories = []
  } = options;
  
  // Parse size string to bytes
  const maxBytes = parseSize(maxFileSize);
  
  // Configure multer with validation
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxBytes,
      files: maxFiles
    },
    fileFilter: (req, file, cb) => {
      try {
        // Apply validation if rules exist
        if (allowedTypes.length || allowedCategories.length) {
          validateFile(file, {
            allowedTypes,
            allowedCategories,
            maxSize: maxFileSize
          });
        }
        cb(null, true);
      } catch (error) {
        cb(new Error(error.message), false);
      }
    }
  });
  
  // Handle field-based uploads (multiple named fields)
  if (Array.isArray(fields) && fields.length > 0) {
    const multerFields = fields.map(field => ({
      name: typeof field === 'string' ? field : field.name,
      maxCount: field.maxCount || options[field]?.maxCount || 1
    }));
    
    return [
      upload.fields(multerFields),
      // Pass-through middleware - no transformation needed
      (req, res, next) => next()
    ];
  }
  
  // Handle multiple files to same field
  if (multiple) {
    return [
      upload.array(fieldName, maxFiles),
      (req, res, next) => next()
    ];
  }
  
  // Handle single file upload (default)
  return [
    upload.single(fieldName),
    (req, res, next) => next()
  ];
}

/**
 * Error handler for upload middleware
 */
export function handleUploadErrors(err, req, res, next) {
  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files',
        code: 'TOO_MANY_FILES'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Unexpected field',
        code: 'UNEXPECTED_FIELD'
      });
    }
    return res.status(400).json({ 
      error: err.message,
      code: 'UPLOAD_ERROR'
    });
  }
  
  // Validation errors (thrown by validateFile)
  if (err.message?.includes('not allowed') || err.message?.includes('too large')) {
    return res.status(400).json({
      error: err.message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  // Pass through other errors
  next(err);
}

/**
 * Convenience middleware creator with validation
 */
export function uploadMiddleware(fieldConfig = {}, validationRules = {}) {
  const middleware = createUploadMiddleware({
    ...fieldConfig,
    ...validationRules
  });
  
  return [...middleware, handleUploadErrors];
}

// For backward compatibility
export default { createUploadMiddleware, handleUploadErrors, uploadMiddleware };