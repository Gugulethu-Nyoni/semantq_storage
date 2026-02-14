// @semantq/storage/lib/StorageService.js
// Core storage service - lightweight and flexible

import * as providers from '../providers/index.js';
import { validateFile, generateFileName, sanitizeFileName, parseSize, getFileInfo } from '../utils.js';

export default class StorageService {
  /**
   * Create a new storage service instance
   * @param {Object} config - Storage configuration
   */
  constructor(config = {}) {
    this.config = {
      provider: 'uploadthing',
      maxFileSize: '50MB', // Now string-based for better DX
      defaultFolder: 'uploads',
      ...config
    };
    
    // Parse maxFileSize to bytes for internal use
    this.maxBytes = parseSize(this.config.maxFileSize);
    
    // Initialize provider
    this.provider = this._initProvider();
  }
  
  /**
   * Initialize the appropriate provider
   * @private
   */
  _initProvider() {
    const providerType = this.config.provider?.toLowerCase();
    
    // Handle different provider config formats
    let Provider;
    
    if (typeof this.config.provider === 'string') {
      // String provider name
      Provider = providers[providerType];
      if (!Provider) {
        throw new Error(`Provider "${this.config.provider}" not supported. Available: ${Object.keys(providers).join(', ')}`);
      }
      return new Provider(this.config[providerType] || this.config.options || {});
    } else if (this.config.provider?.type) {
      // Object with type property
      Provider = providers[this.config.provider.type.toLowerCase()];
      if (!Provider) {
        throw new Error(`Provider "${this.config.provider.type}" not supported. Available: ${Object.keys(providers).join(', ')}`);
      }
      return new Provider(this.config.provider.options || {});
    }
    
    throw new Error('Invalid provider configuration');
  }
  
  /**
   * Initialize the storage provider (for async setup)
   * @returns {Promise<this>}
   */
  async init() {
    if (this.provider && typeof this.provider.init === 'function') {
      await this.provider.init();
    }
    return this;
  }
  
  /**
   * Upload single or multiple files
   * @param {File|File[]|Object|Object[]} files - File(s) to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object|Object[]>} Upload results
   */
  async upload(files, options = {}) {
    const isArray = Array.isArray(files);
    const fileArray = isArray ? files : [files];
    
    if (fileArray.length === 0) {
      throw new Error('No files provided for upload');
    }
    
    // Prepare common options
    const uploadOptions = {
      folder: options.folder || this.config.defaultFolder,
      metadata: {
        ...options.metadata,
        uploadedAt: new Date().toISOString()
      }
    };
    
    // Validate and prepare each file
    const preparedFiles = await Promise.all(
      fileArray.map(async (file, index) => {
        // Validate file
        await this._validateFile(file, {
          maxSize: options.maxSize || this.config.maxFileSize,
          allowedTypes: options.allowedTypes,
          allowedCategories: options.allowedCategories
        });
        
        // Prepare file with metadata
        return this._prepareFile(file, {
          ...uploadOptions,
          index
        });
      })
    );
    
    // Upload files
    const uploads = await Promise.all(
      preparedFiles.map(file => this.provider.upload(file, uploadOptions))
    );
    
    return isArray ? uploads : uploads[0];
  }
  
  /**
   * Upload multiple files to different fields
   * @param {Object} fileFields - Object with field names as keys and file arrays as values
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Results by field name
   */
  async uploadFields(fileFields, options = {}) {
    const results = {};
    const errors = [];
    
    for (const [fieldName, files] of Object.entries(fileFields)) {
      if (!files || (Array.isArray(files) && files.length === 0)) continue;
      
      try {
        const fieldOptions = {
          ...options,
          folder: options.folder ? `${options.folder}/${fieldName}` : fieldName,
          metadata: {
            ...options.metadata,
            field: fieldName
          }
        };
        
        results[fieldName] = await this.upload(files, fieldOptions);
      } catch (error) {
        errors.push({ field: fieldName, error: error.message });
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Upload errors: ${JSON.stringify(errors)}`);
    }
    
    return results;
  }
  
  /**
   * Delete file by URL or key
   * @param {string|string[]} urlOrKey - File URL(s) or key(s) to delete
   * @returns {Promise<Object|Object[]>} Delete results
   */
  async delete(urlOrKey) {
    const isArray = Array.isArray(urlOrKey);
    const items = isArray ? urlOrKey : [urlOrKey];
    
    const results = await Promise.all(
      items.map(item => this.provider.delete(item))
    );
    
    return isArray ? results : results[0];
  }
  
  /**
   * List files with optional prefix
   * @param {string} prefix - Folder/key prefix
   * @returns {Promise<Array>} List of files
   */
  async list(prefix = '') {
    if (!this.provider.list) {
      throw new Error(`Provider ${this.config.provider} does not support listing`);
    }
    return this.provider.list(prefix);
  }
  
  /**
   * Get file info by URL or key
   * @param {string} urlOrKey - File URL or key
   * @returns {Promise<Object>} File information
   */
  async getInfo(urlOrKey) {
    if (!this.provider.getInfo) {
      throw new Error(`Provider ${this.config.provider} does not support getInfo`);
    }
    return this.provider.getInfo(urlOrKey);
  }
  
  /**
   * Extract files from Express request
   * @param {Object} req - Express request object
   * @param {Object} fieldConfig - Field configuration
   * @returns {Object} Files organized by field name
   */
  extractFiles(req, fieldConfig = {}) {
    const files = {};
    
    // Handle single file
    if (req.file) {
      files[req.file.fieldname] = [req.file];
    }
    
    // Handle multiple files (array)
    if (req.files && Array.isArray(req.files)) {
      // Group by fieldname
      req.files.forEach(file => {
        if (!files[file.fieldname]) {
          files[file.fieldname] = [];
        }
        files[file.fieldname].push(file);
      });
    }
    
    // Handle fields (object with fieldname arrays)
    if (req.files && !Array.isArray(req.files) && typeof req.files === 'object') {
      Object.assign(files, req.files);
    }
    
    // If no field config, return all files
    if (Object.keys(fieldConfig).length === 0) {
      return files;
    }
    
    // Filter and validate against field config
    const filtered = {};
    for (const [fieldName, config] of Object.entries(fieldConfig)) {
      const fieldFiles = files[fieldName];
      
      if (fieldFiles) {
        // Validate count
        if (config.maxCount && fieldFiles.length > config.maxCount) {
          throw new Error(`Too many files for ${fieldName}. Max: ${config.maxCount}`);
        }
        
        // Validate required
        if (config.required && fieldFiles.length === 0) {
          throw new Error(`Field ${fieldName} is required`);
        }
        
        filtered[fieldName] = fieldFiles;
      } else if (config.required) {
        throw new Error(`Field ${fieldName} is required`);
      }
    }
    
    return filtered;
  }
  
  /**
   * Validate a file against constraints
   * @private
   */
  async _validateFile(file, options = {}) {
    // Combine service config with options
    const constraints = {
      maxSize: options.maxSize || this.config.maxFileSize,
      allowedTypes: options.allowedTypes,
      allowedCategories: options.allowedCategories
    };
    
    try {
      validateFile(file, constraints);
    } catch (error) {
      throw new Error(`File validation failed: ${error.message}`);
    }
    
    return true;
  }
  
  /**
   * Prepare file for upload (add metadata, generate filename)
   * @private
   */
  async _prepareFile(file, options = {}) {
    // Get file info
    const info = getFileInfo(file);
    
    // Generate unique filename if not provided
    if (!file.filename && !options.keepOriginalName) {
      const prefix = options.folder ? `${options.folder}-` : '';
      file.filename = generateFileName(info.name, prefix);
    }
    
    // Add metadata to file
    file.metadata = {
      ...options.metadata,
      originalName: info.name,
      mimeType: info.mimeType,
      size: info.size,
      index: options.index
    };
    
    return file;
  }
  
  /**
   * Get provider instance
   * @returns {Object} Provider instance
   */
  getProvider() {
    return this.provider;
  }
  
  /**
   * Check if provider is ready
   * @returns {boolean} True if provider is initialized
   */
  isReady() {
    return this.provider !== null;
  }
}