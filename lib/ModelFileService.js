// @semantql/storage/lib/ModelFileService.js
import { createStorage } from '../index.js';
import StorageConfig from './config.js';
import { expandCategories, validateFile } from '../utils.js';

export class ModelFileService {
  /**
   * Create a ModelFileService for a specific model
   * @param {string} modelName - Name of the model (e.g., 'Product')
   * @param {Object} modelFileConfig - Model-specific file configuration
   * @param {string} projectRoot - Project root directory
   */
  constructor(modelName, modelFileConfig = {}, projectRoot = process.cwd()) {
    this.modelName = modelName;
    this.modelFileConfig = this.normalizeModelConfig(modelFileConfig);
    this.projectRoot = projectRoot;
    
    // Initialize storage service with loaded config
    this.storage = null;
    this.storageConfig = null;
    this._initPromise = this._initializeStorage();
  }
  
  /**
   * Initialize storage service asynchronously
   */
  async _initializeStorage() {
    try {
      // Load storage configuration
      this.storageConfig = await StorageConfig.load(this.projectRoot);
      
      // Create storage instance
      this.storage = createStorage(this.storageConfig);
      
      console.log(info(`ModelFileService initialized for ${this.modelName}`));
    } catch (error) {
      console.error(error(`Failed to initialize storage for ${this.modelName}:`), error.message);
      throw error;
    }
  }
  
  /**
   * Wait for initialization and get storage instance
   */
  async _getStorage() {
    await this._initPromise;
    return this.storage;
  }
  
  /**
   * Normalize model file configuration
   */
  normalizeModelConfig(config) {
    return {
      fileFields: config.fileFields || {},
      validation: config.validation || {},
      folderTemplate: config.folderTemplate || '{model}/{id}',
      ...config
    };
  }
  
  /**
   * Get upload middleware for this model
   * @returns {Array} Express middleware array
   */
  getUploadMiddleware() {
    const fields = Object.keys(this.modelFileConfig.fileFields || {});
    
    if (fields.length === 0) {
      return [];
    }
    
    // Get allowed types from model config
    const allowedTypes = [];
    const allowedCategories = [];
    
    Object.values(this.modelFileConfig.fileFields).forEach(fieldConfig => {
      if (fieldConfig.allowedTypes) {
        allowedTypes.push(...fieldConfig.allowedTypes);
      }
      if (fieldConfig.allowedCategories) {
        allowedCategories.push(...fieldConfig.allowedCategories);
      }
    });
    
    const { createUploadMiddleware } = await import('../middleware.js');
    
    return createUploadMiddleware({
      fields,
      allowedTypes: [...new Set(allowedTypes)],
      allowedCategories: [...new Set(allowedCategories)],
      maxFileSize: this.modelFileConfig.validation?.maxFileSize || this.storageConfig?.maxFileSize || 50 * 1024 * 1024,
    });
  }
  
  /**
   * Process files from request for this model
   * @param {Object} req - Express request object
   * @param {Object} context - Context for folder path (e.g., {id: 123})
   * @returns {Promise<Object>} Processed file URLs
   */
  async processFiles(req, context = {}) {
    const storage = await this._getStorage();
    const results = {};
    const uploadedFiles = req.uploadedFiles || req.files || {};
    
    // Build base folder path
    const baseFolder = StorageConfig.resolveFolderPath(
      this.modelFileConfig.folderTemplate,
      { model: this.modelName.toLowerCase(), ...context }
    );
    
    for (const [fieldName, fieldConfig] of Object.entries(this.modelFileConfig.fileFields || {})) {
      const fieldFiles = uploadedFiles[fieldName];
      
      if (!fieldFiles || fieldFiles.length === 0) {
        continue;
      }
      
      // Validate max count
      const filesArray = Array.isArray(fieldFiles) ? fieldFiles : [fieldFiles];
      if (fieldConfig.maxCount && filesArray.length > fieldConfig.maxCount) {
        throw new Error(`Too many files for ${fieldName}. Max: ${fieldConfig.maxCount}`);
      }
      
      // Validate each file
      for (const file of filesArray) {
        this._validateFile(file, fieldConfig);
      }
      
      // Build folder path for this field
      const folder = `${baseFolder}/${fieldName}`;
      
      // Upload files
      const uploadOptions = {
        folder,
        allowedTypes: fieldConfig.allowedTypes,
        allowedCategories: fieldConfig.allowedCategories,
        maxSize: fieldConfig.maxSize,
        metadata: {
          model: this.modelName,
          field: fieldName,
          ...context,
          ...fieldConfig.metadata
        }
      };
      
      const uploadResult = await storage.upload(filesArray, uploadOptions);
      
      // Store results
      results[fieldName] = Array.isArray(uploadResult) 
        ? uploadResult.map(r => r.url)
        : uploadResult.url;
    }
    
    return results;
  }
  
  /**
   * Validate a single file against field configuration
   */
  _validateFile(file, fieldConfig) {
    const constraints = {
      maxSize: fieldConfig.maxSize,
      allowedTypes: fieldConfig.allowedTypes,
      allowedCategories: fieldConfig.allowedCategories,
      disallowedTypes: fieldConfig.disallowedTypes,
      disallowedCategories: fieldConfig.disallowedCategories
    };
    
    return validateFile(file, constraints);
  }
  
  /**
   * Delete files for a record
   * @param {Object} record - Database record with file URLs
   */
  async deleteFiles(record) {
    const storage = await this._getStorage();
    const deletePromises = [];
    
    for (const [fieldName] of Object.entries(this.modelFileConfig.fileFields || {})) {
      const urls = record[fieldName];
      if (!urls) continue;
      
      const urlList = Array.isArray(urls) ? urls : [urls];
      
      for (const url of urlList.filter(Boolean)) {
        deletePromises.push(
          storage.delete(url).catch(error => {
            console.warn(warning(`Failed to delete ${url}:`), error.message);
          })
        );
      }
    }
    
    await Promise.all(deletePromises);
  }
  
  /**
   * Clean up files that are being replaced
   * @param {Object} existingRecord - Existing database record
   * @param {Object} newFileUrls - New file URLs
   */
  async cleanupReplacedFiles(existingRecord, newFileUrls) {
    const storage = await this._getStorage();
    const deletePromises = [];
    
    for (const [fieldName] of Object.entries(this.modelFileConfig.fileFields || {})) {
      const existingUrls = existingRecord[fieldName];
      const newUrls = newFileUrls[fieldName];
      
      if (!existingUrls || !newUrls) continue;
      
      const existingList = Array.isArray(existingUrls) ? existingUrls : [existingUrls];
      const newList = Array.isArray(newUrls) ? newUrls : [newUrls];
      
      // Find URLs that exist in old but not in new
      const toDelete = existingList.filter(url => 
        url && !newList.includes(url)
      );
      
      for (const url of toDelete) {
        deletePromises.push(
          storage.delete(url).catch(error => {
            console.warn(warning(`Failed to delete old file ${url}:`), error.message);
          })
        );
      }
    }
    
    await Promise.all(deletePromises);
  }
}

// Helper function to create a ModelFileService
export function createModelFileService(modelName, modelFileConfig = {}, projectRoot = process.cwd()) {
  return new ModelFileService(modelName, modelFileConfig, projectRoot);
}

// Re-export for convenience
export default ModelFileService;
