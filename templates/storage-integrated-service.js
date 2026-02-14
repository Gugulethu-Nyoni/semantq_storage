// templates/storage-integrated-service.js
import { createModelFileService } from '@semantql/storage';

/**
 * Template for creating a storage-integrated service
 * This shows how to wrap an existing service with file upload capabilities
 * 
 * @param {Object} baseService - Your existing CRUD service
 * @param {string} modelName - Model name (e.g., 'Product')
 * @param {Object} modelFileConfig - File field configuration
 * @returns {Object} Enhanced service with file handling
 */
export function createStorageIntegratedService(baseService, modelName, modelFileConfig = {}) {
  // Create model file service
  const fileService = createModelFileService(modelName, modelFileConfig);
  
  // Return enhanced service
  return {
    // Create with files
    async create(data, req = null) {
      const mergedData = { ...data };
      
      if (req) {
        const fileUrls = await fileService.processFiles(req, { id: 'temp' });
        Object.assign(mergedData, fileUrls);
      }
      
      const result = await baseService.create(mergedData);
      return result;
    },
    
    // Update with files
    async update(id, data, req = null) {
      const mergedData = { ...data };
      
      if (req) {
        // Get existing record for cleanup
        const existing = await baseService.getById(id);
        
        const fileUrls = await fileService.processFiles(req, { id });
        Object.assign(mergedData, fileUrls);
        
        // Clean up old files being replaced
        await fileService.cleanupReplacedFiles(existing, fileUrls);
      }
      
      return baseService.update(id, mergedData);
    },
    
    // Delete with file cleanup
    async delete(id) {
      const record = await baseService.getById(id);
      
      // Delete associated files (fire and forget - don't block)
      fileService.deleteFiles(record).catch(err => {
        console.warn(`File cleanup warning for ${modelName} ${id}:`, err.message);
      });
      
      // Delete from database
      return baseService.delete(id);
    },
    
    // Pass through other methods
    getById: baseService.getById?.bind(baseService),
    getAll: baseService.getAll?.bind(baseService),
    findWithPagination: baseService.findWithPagination?.bind(baseService),
    
    // Expose file service methods for direct use
    getUploadMiddleware: () => fileService.getUploadMiddleware(),
    processFiles: (req, context) => fileService.processFiles(req, context),
    deleteFiles: (record) => fileService.deleteFiles(record),
    cleanupReplacedFiles: (existing, newUrls) => fileService.cleanupReplacedFiles(existing, newUrls)
  };
}

export default createStorageIntegratedService;