// @semantql/storage - Main exports
import StorageService from './lib/StorageService.js';
import * as providers from './providers/index.js';
import { createUploadMiddleware } from './middleware.js';
import { 
  defineFileFields, 
  validateFile, 
  generateFolderPath 
} from './utils.js';

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
  generateFolderPath
};

// Default export
export default { createStorage, providers, createUploadMiddleware };