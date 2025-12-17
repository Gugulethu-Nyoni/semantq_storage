// @semantql/storage/index.js
import StorageService from './lib/StorageService.js';
import * as providers from './providers/index.js';
import { createUploadMiddleware } from './middleware.js';
import { 
  defineFileFields, 
  validateFile, 
  generateFolderPath,
  MIME_CATEGORIES,
  getMimeTypesForCategory,
  expandCategories
} from './utils.js';

// Import new components
import StorageConfig from './lib/config.js';
import { ModelFileService, createModelFileService } from './lib/ModelFileService.js';

// Factory function for easy creation
export function createStorage(config = {}) {
  return new StorageService(config);
}

// Re-export everything
export {
  StorageService,
  providers,
  createUploadMiddleware,
  defineFileFields,
  validateFile,
  generateFolderPath,
  MIME_CATEGORIES,
  getMimeTypesForCategory,
  expandCategories,
  // New exports
  StorageConfig,
  ModelFileService,
  createModelFileService
};

// Default export
export default { 
  createStorage, 
  providers, 
  createUploadMiddleware,
  createModelFileService,
  StorageConfig,
  ModelFileService
};