// utils.js - Enhanced with category support
export const MIME_CATEGORIES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp', 'image/tiff'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/midi', 'audio/x-wav', 'audio/x-m4a'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/plain'
  ],
  spreadsheet: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv'
  ],
  presentation: [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.presentation'
  ],
  archive: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-7z-compressed'
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
    'text/css'
  ]
};

/**
 * Get MIME types for a category
 */
export function getMimeTypesForCategory(category) {
  return MIME_CATEGORIES[category] || [];
}

/**
 * Expand categories to MIME types
 */
export function expandCategories(categories = []) {
  const mimeTypes = new Set();
  
  categories.forEach(category => {
    if (category === '*') {
      // Add all known MIME types
      Object.values(MIME_CATEGORIES).forEach(categoryTypes => {
        categoryTypes.forEach(type => mimeTypes.add(type));
      });
    } else if (MIME_CATEGORIES[category]) {
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
 * Enhanced file validation with category support
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
      throw new Error(`File exceeds maximum size of ${maxSize}`);
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
  if (allowedMimeTypes.length === 0 && disallowedTypes.length === 0) {
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
      throw new Error(`File type ${file.mimetype} not allowed. Allowed: ${allowedMimeTypes.join(', ')}`);
    }
  }
  
  return true;
}