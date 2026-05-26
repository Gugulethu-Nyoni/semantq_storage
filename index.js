// @semantq/storage/index.js

import configLoader from '../../../config_loader.js';
import StorageService from './lib/StorageService.js';

let storageService = null;

export async function getStorageService() {
  if (!storageService) {
    const config = await configLoader();
    storageService = new StorageService(config.storage);
  }
  return storageService;
}

export const Storage = {
  async upload(file, metadata = {}) {
    const service = await getStorageService();
    let fileBuffer = file;
    if (file instanceof File) {
      fileBuffer = Buffer.from(await file.arrayBuffer());
    }
    return service.upload(fileBuffer, metadata);
  },

  async delete(storageKey) {
    const service = await getStorageService();
    return service.delete(storageKey);
  },

  async getUrl(storageKey) {
    const service = await getStorageService();
    return service.getUrl(storageKey);
  },

  async getBuffer(storageKey) {
    const service = await getStorageService();
    return service.getBuffer(storageKey);
  },

  async exists(storageKey) {
    const service = await getStorageService();
    return service.exists(storageKey);
  }
};

export { default as BaseStorageProvider } from './providers/BaseProvider.js';
export { default as LocalProvider } from './providers/LocalProvider.js';
export { default as UploadThingProvider } from './providers/UploadThingProvider.js';
export { default as StorageService } from './lib/StorageService.js';

export default Storage;