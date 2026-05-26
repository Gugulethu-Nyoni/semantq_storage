// packages/@semantq/storage/providers/UploadThingProvider.js

import BaseStorageProvider from './BaseProvider.js';
import LocalProvider from './LocalProvider.js';

export class UploadThingProvider extends BaseStorageProvider {
  constructor(config) {
    super(config);
    this.name = 'uploadthing';
    this.token = config.uploadthing?.token;
    this.appId = config.uploadthing?.appId;
    this.config = config;
  }

  async upload(fileBuffer, options) {
    // If UploadThing is not configured, fall back to local
    if (!this.token) {
      console.warn('[UploadThingProvider] No token configured, falling back to local provider');
      const localProvider = new LocalProvider(this.config);
      return localProvider.upload(fileBuffer, options);
    }
    
    // Otherwise use UploadThing (implement when token is available)
    throw new Error('UploadThing not fully configured. Please set UPLOADTHING_TOKEN or change STORAGE_ACTIVE_PROVIDER to "local"');
  }

  async delete(storageKey) {
    if (!this.token) {
      const localProvider = new LocalProvider(this.config);
      return localProvider.delete(storageKey);
    }
    return false;
  }

  async getUrl(storageKey) {
    if (!this.token) {
      const localProvider = new LocalProvider(this.config);
      return localProvider.getUrl(storageKey);
    }
    return storageKey;
  }

  async exists(storageKey) {
    if (!this.token) {
      const localProvider = new LocalProvider(this.config);
      return localProvider.exists(storageKey);
    }
    return false;
  }

  async getBuffer(storageKey) {
    if (!this.token) {
      const localProvider = new LocalProvider(this.config);
      return localProvider.getBuffer(storageKey);
    }
    throw new Error('getBuffer not implemented for UploadThing');
  }
}

export default UploadThingProvider;