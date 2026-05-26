// @semantq/storage/providers/LocalProvider.js

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import BaseStorageProvider from './BaseProvider.js';

export class LocalProvider extends BaseStorageProvider {
  constructor(config) {
    super(config);
    this.name = 'local';
    this.uploadDir = config.local?.uploadDir || './uploads';
    this.baseUrl = config.local?.baseUrl || '/uploads';
  }

  generateFilePath(organizationId, modelName, recordId, fieldKey, originalName) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${baseName}_${timestamp}_${random}${ext}`;
    
    return path.join(
      this.uploadDir,
      String(organizationId),
      modelName.toLowerCase(),
      recordId,
      fieldKey.toLowerCase(),
      filename
    );
  }

  getPublicUrl(filePath) {
    const relativePath = path.relative(this.uploadDir, filePath);
    return `${this.baseUrl}/${relativePath.replace(/\\/g, '/')}`;
  }

  async upload(fileBuffer, options) {
    const { organizationId, modelName, recordId, fieldKey, originalName, mimeType } = options;
    
    // Ensure fileBuffer is actually a Buffer
    let buffer = fileBuffer;
    
    // If it's an object with buffer property (like multer file)
    if (fileBuffer && fileBuffer.buffer && Buffer.isBuffer(fileBuffer.buffer)) {
      buffer = fileBuffer.buffer;
    }
    // If it's already a Buffer
    else if (Buffer.isBuffer(fileBuffer)) {
      buffer = fileBuffer;
    }
    // If it's a Uint8Array or similar
    else if (fileBuffer && typeof fileBuffer.byteLength !== 'undefined') {
      buffer = Buffer.from(fileBuffer);
    }
    else {
      console.error('[LocalProvider] Invalid fileBuffer type:', typeof fileBuffer, fileBuffer?.constructor?.name);
      throw new Error('Invalid file buffer: expected Buffer, received ' + typeof fileBuffer);
    }
    
    const storageKey = this.generateFilePath(organizationId, modelName, recordId, fieldKey, originalName);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(storageKey), { recursive: true });
    
    // Write buffer to file
    await fs.writeFile(storageKey, buffer);
    
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    console.log(`[LocalProvider] File saved: ${storageKey}`);
    
    return {
      storageKey: storageKey,
      publicUrl: this.getPublicUrl(storageKey),
      fileHash: fileHash
    };
  }

  async delete(storageKey) {
    try {
      await fs.unlink(storageKey);
      console.log(`[LocalProvider] File deleted: ${storageKey}`);
      return true;
    } catch (err) {
      console.error('[LocalProvider] Delete failed:', err.message);
      return false;
    }
  }

  async getUrl(storageKey) {
    return this.getPublicUrl(storageKey);
  }

  async exists(storageKey) {
    try {
      await fs.access(storageKey);
      return true;
    } catch {
      return false;
    }
  }

  async getBuffer(storageKey) {
    return await fs.readFile(storageKey);
  }
}

export default LocalProvider;