// Core storage service - lightweight and flexible
// lib/StorageService.js
import * as providers from '../providers/index.js';

export default class StorageService {
  constructor(config = {}) {
    this.config = {
      provider: 'uploadthing',
      maxFileSize: 50 * 1024 * 1024, // 50MB
      ...config
    };
    
    this.provider = this._initProvider();
  }
  
  _initProvider() {
    const Provider = providers[this.config.provider];
    if (!Provider) {
      throw new Error(`Provider "${this.config.provider}" not supported. Available: ${Object.keys(providers).join(', ')}`);
    }
    
    return new Provider(this.config);
  }
  
  /**
   * Upload single or multiple files
   * @param {File|File[]} files - File(s) to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object|Object[]>} Upload results
   */
  async upload(files, options = {}) {
    const isArray = Array.isArray(files);
    const fileArray = isArray ? files : [files];
    
    // Validate files
    const validations = fileArray.map(file => 
      this._validateFile(file, options)
    );
    await Promise.all(validations);
    
    // Upload files
    const uploads = await Promise.all(
      fileArray.map(file => this.provider.upload(file, options))
    );
    
    return isArray ? uploads : uploads[0];
  }
  
  /**
   * Delete file by URL
   * @param {string} url - File URL to delete
   * @returns {Promise<void>}
   */
  async delete(url) {
    return this.provider.delete(url);
  }
  
  /**
   * Process multiple file fields (e.g., mainImage, galleryImages)
   * @param {Object} fileFields - Object with field names as keys
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Results by field name
   */
  async process(fileFields, options = {}) {
    const results = {};
    const uploadPromises = [];
    
    for (const [fieldName, files] of Object.entries(fileFields)) {
      if (!files || files.length === 0) continue;
      
      const fieldOptions = {
        ...options,
        folder: options.folder ? `${options.folder}/${fieldName}` : fieldName
      };
      
      uploadPromises.push(
        this.upload(files, fieldOptions)
          .then(uploadResults => {
            results[fieldName] = uploadResults;
          })
      );
    }
    
    await Promise.all(uploadPromises);
    return results;
  }
  
  /**
   * Extract files from Express request based on field configuration
   * @param {Object} req - Express request object
   * @param {Object} fieldConfig - Field configuration
   * @returns {Object} Files organized by field name
   */
  extractFiles(req, fieldConfig = {}) {
    const files = {};
    
    // If no config, return all files
    if (Object.keys(fieldConfig).length === 0) {
      return req.files || {};
    }
    
    // Organize by field config
    for (const [fieldName, config] of Object.entries(fieldConfig)) {
      const reqFiles = req.files?.[fieldName];
      
      if (reqFiles) {
        files[fieldName] = Array.isArray(reqFiles) ? reqFiles : [reqFiles];
        
        // Validate against config
        if (config.maxCount && files[fieldName].length > config.maxCount) {
          throw new Error(`Too many files for ${fieldName}. Max: ${config.maxCount}`);
        }
      }
    }
    
    return files;
  }
  
  _validateFile(file, options) {
    // File size validation
    if (file.size > this.config.maxFileSize) {
      throw new Error(`File too large. Max size: ${this.config.maxFileSize / 1024 / 1024}MB`);
    }
    
    // MIME type validation if specified
    if (options.allowedTypes?.length > 0) {
      const isValid = options.allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.mimetype.startsWith(type.split('/')[0] + '/');
        }
        return file.mimetype === type;
      });
      
      if (!isValid) {
        throw new Error(`Invalid file type. Allowed: ${options.allowedTypes.join(', ')}`);
      }
    }
    
    return true;
  }
}