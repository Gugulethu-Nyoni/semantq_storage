// @semantq/storage/providers/BaseProvider.js

export class BaseStorageProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * Upload a file to storage
   * @param {Buffer} fileBuffer - File data
   * @param {Object} options - Upload options
   * @param {number} options.organizationId - Organization ID
   * @param {string} options.modelName - Model name (Budget, ProjectFile, etc.)
   * @param {string} options.recordId - Record UUID
   * @param {string} options.fieldKey - Field name (amount, fileUrl, etc.)
   * @param {string} options.originalName - Original filename
   * @param {string} options.mimeType - File MIME type
   * @returns {Promise<Object>} { storageKey, publicUrl, fileSize, fileHash }
   */
  async upload(fileBuffer, options) {
    throw new Error(`upload() not implemented for provider ${this.name}`);
  }

  /**
   * Delete a file from storage
   * @param {string} storageKey - Provider-specific storage key
   * @returns {Promise<boolean>}
   */
  async delete(storageKey) {
    throw new Error(`delete() not implemented for provider ${this.name}`);
  }

  /**
   * Get public URL for a file
   * @param {string} storageKey - Provider-specific storage key
   * @returns {Promise<string>}
   */
  async getUrl(storageKey) {
    throw new Error(`getUrl() not implemented for provider ${this.name}`);
  }

  /**
   * Check if file exists
   * @param {string} storageKey - Provider-specific storage key
   * @returns {Promise<boolean>}
   */
  async exists(storageKey) {
    throw new Error(`exists() not implemented for provider ${this.name}`);
  }

  /**
   * Get file as buffer
   * @param {string} storageKey - Provider-specific storage key
   * @returns {Promise<Buffer>}
   */
  async getBuffer(storageKey) {
    throw new Error(`getBuffer() not implemented for provider ${this.name}`);
  }

  /**
   * Generate structured storage key
   * Pattern: {orgId}/{model}/{recordId}/{fieldKey}/{timestamp}_{random}_{filename}
   */
  generateStorageKey(organizationId, modelName, recordId, fieldKey, originalName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedModel = modelName.toLowerCase();
    const sanitizedField = fieldKey.toLowerCase();
    const ext = originalName.split('.').pop() || '';
    const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${baseName}_${timestamp}_${random}.${ext}`;
    
    return `${organizationId}/${sanitizedModel}/${recordId}/${sanitizedField}/${filename}`;
  }
}

export default BaseStorageProvider;