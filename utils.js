import mime from 'mime-types';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// MIME Categories (your existing ones are good, just adding a few more)
export const MIME_CATEGORIES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp', 'image/tiff', 'image/heic', 'image/avif'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/midi', 'audio/x-wav', 'audio/x-m4a', 'audio/aac', 'audio/flac'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/mpeg', 'video/3gpp'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/plain',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.google-apps.document'
  ],
  spreadsheet: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'application/vnd.google-apps.spreadsheet'
  ],
  presentation: [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.google-apps.presentation'
  ],
  archive: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-7z-compressed',
    'application/x-bzip',
    'application/x-bzip2'
  ],
  code: [
    'text/javascript',
    'application/javascript',
    'text/x-python',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++',
    'text/x-php',
    'application/json',
    'application/xml',
    'text/html',
    'text/css',
    'text/markdown',
    'text/x-typescript'
  ],
  font: [
    'font/ttf',
    'font/woff',
    'font/woff2',
    'application/x-font-ttf',
    'application/x-font-otf'
  ],
  text: [
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'text/css',
    'text/xml',
    'text/calendar'
  ]
};

/**
 * Get MIME types for a category
 * @param {string} category - Category name
 * @returns {string[]} Array of MIME types
 */
export function getMimeTypesForCategory(category) {
  return MIME_CATEGORIES[category] || [];
}

/**
 * Expand categories to MIME types with wildcard support
 * @param {string|string[]} categories - Categories to expand
 * @returns {string[]} Array of MIME types
 */
export function expandCategories(categories = []) {
  if (!Array.isArray(categories)) categories = [categories];
  
  const mimeTypes = new Set();
  
  categories.forEach(category => {
    if (!category) return;
    
    if (category === '*') {
      // Add all known MIME types
      Object.values(MIME_CATEGORIES).forEach(categoryTypes => {
        categoryTypes.forEach(type => mimeTypes.add(type));
      });
    } else if (MIME_CATEGORIES[category]) {
      // Known category
      MIME_CATEGORIES[category].forEach(type => mimeTypes.add(type));
    } else if (category.includes('/*')) {
      // Handle wildcards like 'image/*'
      const prefix = category.split('/*')[0];
      Object.values(MIME_CATEGORIES).forEach(categoryTypes => {
        categoryTypes.forEach(type => {
          if (type.startsWith(`${prefix}/`)) {
            mimeTypes.add(type);
          }
        });
      });
    } else {
      // Assume it's already a MIME type
      mimeTypes.add(category);
    }
  });
  
  return Array.from(mimeTypes);
}

/**
 * Define file fields with type safety (fluent API)
 * @param {Object} fields - Field configuration
 * @returns {Object} The same fields object
 */
export function defineFileFields(fields) {
  return fields;
}

/**
 * Generate folder path from template
 * @param {string} template - Folder template with {placeholders}
 * @param {Object} context - Values for placeholders
 * @returns {string} Generated folder path
 */
export function generateFolderPath(template, context = {}) {
  return template.replace(/{(\w+)}/g, (_, key) => context[key] || key);
}

/**
 * Enhanced file validation with category support
 * @param {Object} file - File object with mimetype and size
 * @param {Object} constraints - Validation constraints
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export function validateFile(file, constraints = {}) {
  const { 
    maxSize, 
    allowedTypes = [], 
    disallowedTypes = [],
    allowedCategories = [],
    disallowedCategories = [] 
  } = constraints;
  
  // Size validation
  if (maxSize) {
    const maxBytes = parseSize(maxSize);
    if (file.size > maxBytes) {
      throw new Error(`File exceeds maximum size of ${formatBytes(maxBytes)}`);
    }
  }
  
  // Prepare allowed MIME types list
  let allowedMimeTypes = [...allowedTypes];
  
  // Add categories to allowed types
  if (allowedCategories.length > 0) {
    const categoryTypes = expandCategories(allowedCategories);
    allowedMimeTypes.push(...categoryTypes);
  }
  
  // If no restrictions, allow everything
  if (allowedMimeTypes.length === 0 && disallowedTypes.length === 0 && disallowedCategories.length === 0) {
    return true;
  }
  
  // Check disallowed types first (more restrictive)
  if (disallowedTypes.length > 0) {
    const isDisallowed = disallowedTypes.some(type => {
      if (type === '*/*') return true;
      if (type.endsWith('/*')) {
        const category = type.split('/')[0];
        return file.mimetype.startsWith(`${category}/`);
      }
      return file.mimetype === type;
    });
    
    if (isDisallowed) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }
  }
  
  // Check disallowed categories
  if (disallowedCategories.length > 0) {
    const disallowedCategoryTypes = expandCategories(disallowedCategories);
    const isInDisallowedCategory = disallowedCategoryTypes.some(type => 
      file.mimetype === type
    );
    
    if (isInDisallowedCategory) {
      throw new Error(`File type ${file.mimetype} is in disallowed category`);
    }
  }
  
  // Check allowed types (if specified)
  if (allowedMimeTypes.length > 0) {
    const isAllowed = allowedMimeTypes.some(type => {
      if (type === '*/*') return true;
      if (type.endsWith('/*')) {
        const category = type.split('/')[0];
        return file.mimetype.startsWith(`${category}/`);
      }
      return file.mimetype === type;
    });
    
    if (!isAllowed) {
      const allowedList = [...new Set(allowedMimeTypes)].join(', ');
      throw new Error(`File type ${file.mimetype} not allowed. Allowed: ${allowedList}`);
    }
  }
  
  return true;
}

/**
 * Parse size string to bytes
 * @param {string|number} size - Size string (e.g., '5MB', '1GB') or number in bytes
 * @returns {number} Size in bytes
 */
export function parseSize(size) {
  if (typeof size === 'number') return size;
  if (!size) return 10 * 1024 * 1024; // Default 10MB
  
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
    'tb': 1024 * 1024 * 1024 * 1024
  };

  const match = String(size).match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/i);
  if (!match) return 10 * 1024 * 1024;

  const [, num, unit] = match;
  return parseFloat(num) * (units[unit.toLowerCase()] || units.mb);
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size (e.g., '5.2 MB')
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique filename
 */
export function generateFileName(originalName, prefix = '') {
  const ext = path.extname(originalName) || '';
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const sanitized = sanitizeFileName(path.basename(originalName, ext));
  
  return `${prefix}${timestamp}-${random}${ext}`;
}

/**
 * Sanitize filename (remove special characters)
 * @param {string} name - Filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeFileName(name) {
  return name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
}

/**
 * Extract file info
 * @param {Object} file - File object
 * @returns {Object} File information
 */
export function getFileInfo(file) {
  const originalName = file.originalname || file.name || 'file';
  const ext = path.extname(originalName);
  const mimeType = file.mimetype || file.type || mime.lookup(originalName) || 'application/octet-stream';
  
  return {
    name: originalName,
    basename: path.basename(originalName, ext),
    extension: ext.replace('.', ''),
    size: file.size,
    mimeType,
    category: findCategory(mimeType)
  };
}

/**
 * Find category for MIME type
 * @param {string} mimeType - MIME type to categorize
 * @returns {string|null} Category name or null
 */
export function findCategory(mimeType) {
  for (const [category, types] of Object.entries(MIME_CATEGORIES)) {
    if (types.includes(mimeType)) {
      return category;
    }
  }
  return null;
}

/**
 * Check if file is an image
 * @param {Object} file - File object
 * @returns {boolean} True if image
 */
export function isImage(file) {
  return file.mimetype?.startsWith('image/') || false;
}

/**
 * Check if file is a video
 * @param {Object} file - File object
 * @returns {boolean} True if video
 */
export function isVideo(file) {
  return file.mimetype?.startsWith('video/') || false;
}

/**
 * Check if file is an audio
 * @param {Object} file - File object
 * @returns {boolean} True if audio
 */
export function isAudio(file) {
  return file.mimetype?.startsWith('audio/') || false;
}

/**
 * Check if file is a document
 * @param {Object} file - File object
 * @returns {boolean} True if document
 */
export function isDocument(file) {
  const docCategories = ['application/pdf', 'application/msword', 'text/plain'];
  return docCategories.includes(file.mimetype) || false;
}

/**
 * Create file hash for deduplication
 * @param {Buffer} buffer - File buffer
 * @returns {string} SHA-256 hash
 */
export function createFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Merge multiple file configs
 * @param {...Object} configs - File configurations
 * @returns {Object} Merged configuration
 */
export function mergeFileConfigs(...configs) {
  return configs.reduce((merged, config) => {
    return {
      ...merged,
      ...config,
      allowedTypes: [...new Set([...(merged.allowedTypes || []), ...(config.allowedTypes || [])])],
      allowedCategories: [...new Set([...(merged.allowedCategories || []), ...(config.allowedCategories || [])])],
      disallowedTypes: [...new Set([...(merged.disallowedTypes || []), ...(config.disallowedTypes || [])])],
      disallowedCategories: [...new Set([...(merged.disallowedCategories || []), ...(config.disallowedCategories || [])])]
    };
  }, {});
}

// Export all utilities
export default {
  MIME_CATEGORIES,
  getMimeTypesForCategory,
  expandCategories,
  defineFileFields,
  generateFolderPath,
  validateFile,
  parseSize,
  formatBytes,
  generateFileName,
  sanitizeFileName,
  getFileInfo,
  findCategory,
  isImage,
  isVideo,
  isAudio,
  isDocument,
  createFileHash,
  mergeFileConfigs
};