// @semantq/storage/lib/StorageService.js

import crypto from 'crypto';
import LocalProvider from '../providers/LocalProvider.js';
import UploadThingProvider from '../providers/UploadThingProvider.js';

class StorageService {
  constructor(config) {
    this.config = config;
    this.activeProvider = config.activeProvider || 'local';
    this.provider = null;
    this.initProvider();
  }

  initProvider() {
    switch (this.activeProvider) {
      case 'uploadthing':
        this.provider = new UploadThingProvider(this.config);
        break;
      case 'local':
      default:
        this.provider = new LocalProvider(this.config);
        break;
    }
    console.log(`[Storage] Initialized ${this.activeProvider} provider`);
  }

  /**
   * Extract buffer from various input types (multer file, Buffer, etc.)
   */
  extractBuffer(fileBuffer) {
    // If it's already a Buffer
    if (Buffer.isBuffer(fileBuffer)) {
      return fileBuffer;
    }
    
    // If it's a multer file object with buffer property
    if (fileBuffer && fileBuffer.buffer && Buffer.isBuffer(fileBuffer.buffer)) {
      return fileBuffer.buffer;
    }
    
    // If it's an ArrayBuffer or TypedArray
    if (fileBuffer && (fileBuffer instanceof ArrayBuffer || ArrayBuffer.isView(fileBuffer))) {
      return Buffer.from(fileBuffer);
    }
    
    // If it's a File object (from browser)
    if (fileBuffer && typeof fileBuffer.arrayBuffer === 'function') {
      // This is async, but we need sync - caller should handle this
      throw new Error('File object detected. Please convert to Buffer before calling upload.');
    }
    
    console.error('[StorageService] Unknown buffer type:', typeof fileBuffer, fileBuffer?.constructor?.name);
    throw new Error(`Invalid file buffer type: ${typeof fileBuffer}`);
  }

  async upload(fileBuffer, options) {
    const {
      organizationId,
      modelName,
      recordId,
      fieldKey,
      originalName = 'file',
      mimeType = 'application/octet-stream',
      ...metadata
    } = options;

    // Validate required fields
    if (!organizationId) throw new Error('organizationId is required');
    if (!modelName) throw new Error('modelName is required');
    if (!recordId) throw new Error('recordId is required');
    if (!fieldKey) throw new Error('fieldKey is required');

    // Extract actual buffer
    const buffer = this.extractBuffer(fileBuffer);
    
    console.log(`[StorageService] Uploading file: ${originalName}, size: ${buffer.length} bytes`);

    const result = await this.provider.upload(buffer, {
      organizationId,
      modelName,
      recordId,
      fieldKey,
      originalName,
      mimeType
    });

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      storageKey: result.storageKey,
      publicUrl: result.publicUrl,
      fileSize: buffer.length,
      fileHash: fileHash,
      metadata: metadata
    };
  }

  async delete(storageKey) {
    return this.provider.delete(storageKey);
  }

  async getUrl(storageKey) {
    return this.provider.getUrl(storageKey);
  }

  async getBuffer(storageKey) {
    return this.provider.getBuffer(storageKey);
  }

  async exists(storageKey) {
    return this.provider.exists(storageKey);
  }

  getActiveProvider() {
    return this.activeProvider;
  }

  setActiveProvider(providerName) {
    if (providerName === this.activeProvider) return;
    this.activeProvider = providerName;
    this.initProvider();
  }
}

export default StorageService;