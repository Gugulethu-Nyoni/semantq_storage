// templates/storage-integrated-service.js
import { createModelFileService } from '@semantql/storage';

/**
 * Template for creating a storage-integrated service
 * This shows how to wrap an existing service with file upload capabilities
 */

export function createStorageIntegratedService(baseService, modelName, modelFileConfig = {}) {
  // Create model file service
  const fileService = createModelFileService(modelName, modelFileConfig);
  
  // Return enhanced service
  return {
    // Enhanced methods
    async create(data, req = null) {
      let fileUrls = {};
      
      if (req) {
        fileUrls = await fileService.processFiles(req, { id: 'new' });
      }
      
      // Merge files with data
      const mergedData = { ...data, ...fileUrls };
      
      // Call base service
      const result = await baseService.create(mergedData);
      
      // Update files with actual ID if needed
      if (req && result.id && result.id !== 'new') {
        // Re-process with actual ID (optional - for folder organization)
        // You could move files from 'new' folder to actual ID folder here
      }
      
      return result;
    },
    
    async update(id, data, req = null) {
      // Get existing record for cleanup
      const existing = await baseService.getById(id);
      
      let fileUrls = {};
      
      if (req) {
        fileUrls = await fileService.processFiles(req, { id });
        
        // Cleanup old files being replaced
        await fileService.cleanupReplacedFiles(existing, fileUrls);
      }
      
      // Merge updates
      const mergedData = { ...data, ...fileUrls };
      
      return baseService.update(id, mergedData);
    },
    
    async delete(id) {
      const record = await baseService.getById(id);
      
      // Delete associated files
      await fileService.deleteFiles(record);
      
      // Delete from database
      return baseService.delete(id);
    },
    
    // Delegate other methods to base service
    getById: baseService.getById?.bind(baseService) || (() => { throw new Error('Method not implemented'); }),
    getAll: baseService.getAll?.bind(baseService) || (() => { throw new Error('Method not implemented'); }),
    findWithPagination: baseService.findWithPagination?.bind(baseService),
    findByField: baseService.findByField?.bind(baseService),
    
    // Expose file service methods
    getUploadMiddleware: () => fileService.getUploadMiddleware(),
    processFiles: (req, context) => fileService.processFiles(req, context),
    deleteFiles: (record) => fileService.deleteFiles(record),
  };
}

export default createStorageIntegratedService;