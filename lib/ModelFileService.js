// @semantql/storage/lib/ModelFileService.js
import { createStorage } from '../index.js';
import StorageConfig from './config.js';
import { validateFile, generateFolderPath } from '../utils.js';

export class ModelFileService {
  /**
   * Create a ModelFileService for a specific model
   * @param {string} modelName - Name of the model (e.g., 'Product')
   * @param {Object} modelFileConfig - Model-specific file configuration
   * @param {string} projectRoot - Project root directory
   */
  constructor(modelName, modelFileConfig = {}, projectRoot = process.cwd()) {
    this.modelName = modelName;
    this.modelFileConfig = {
      fileFields: modelFileConfig.fileFields || {},
      folderTemplate: modelFileConfig.folderTemplate || '{model}/{id}',
      ...modelFileConfig
    };
    this.projectRoot = projectRoot;
    this.storage = null;
    this.storageConfig = null;
    this._initPromise = this._initializeStorage();
  }
  
  async _initializeStorage() {
    this.storageConfig = await StorageConfig.load(this.projectRoot);
    this.storage = createStorage(this.storageConfig);
  }
  
  async _getStorage() {
    await this._initPromise;
    return this.storage;
  }
  
  /**
   * Get upload middleware for this model
   */
  async getUploadMiddleware() {
    const fields = Object.keys(this.modelFileConfig.fileFields);
    if (fields.length === 0) return [];
    
    const { createUploadMiddleware } = await import('../middleware.js');
    return createUploadMiddleware({ fields });
  }
  
  /**
   * Process files from request
   */
  async processFiles(req, context = {}) {
    const storage = await this._getStorage();
    const results = {};
    const files = req.files || {};
    
    const baseFolder = generateFolderPath(
      this.modelFileConfig.folderTemplate,
      { model: this.modelName.toLowerCase(), ...context }
    );
    
    for (const [fieldName, fieldConfig] of Object.entries(this.modelFileConfig.fileFields)) {
      const fieldFiles = files[fieldName];
      if (!fieldFiles || fieldFiles.length === 0) continue;
      
      const fileArray = Array.isArray(fieldFiles) ? fieldFiles : [fieldFiles];
      
      // Validate count
      if (fieldConfig.maxCount && fileArray.length > fieldConfig.maxCount) {
        throw new Error(`Too many files for ${fieldName}`);
      }
      
      // Validate each file
      fileArray.forEach(file => validateFile(file, fieldConfig));
      
      // Upload
      const result = await storage.upload(fileArray, {
        folder: `${baseFolder}/${fieldName}`,
        metadata: { model: this.modelName, field: fieldName, ...context }
      });
      
      // Store result
      results[fieldName] = fieldConfig.maxCount === 1 
        ? (Array.isArray(result) ? result[0]?.url : result.url)
        : result.map(r => r.url);
    }
    
    return results;
  }
  
  /**
   * Delete files for a record
   */
  async deleteFiles(record) {
    const storage = await this._getStorage();
    const promises = [];
    
    for (const fieldName of Object.keys(this.modelFileConfig.fileFields)) {
      const urls = record[fieldName];
      if (!urls) continue;
      
      const urlList = Array.isArray(urls) ? urls : [urls];
      urlList.filter(Boolean).forEach(url => promises.push(storage.delete(url)));
    }
    
    await Promise.all(promises);
  }
}

/**
 * Create a ModelFileService instance
 */
export function createModelFileService(modelName, modelFileConfig = {}, projectRoot = process.cwd()) {
  return new ModelFileService(modelName, modelFileConfig, projectRoot);
}

export default ModelFileService;