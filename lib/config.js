// @semantql/storage/lib/config.js
import { pathToFileURL } from 'url';
import { join } from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { parseSize } from '../utils.js';

// Colors for console (optional - won't break if chalk not installed)
let success = (msg) => msg;
let info = (msg) => msg;
let warning = (msg) => msg;
let error = (msg) => msg;

try {
  // Only use chalk if available
  const chalkModule = await import('chalk').catch(() => null);
  if (chalkModule) {
    success = chalkModule.default.green;
    info = chalkModule.default.blue;
    warning = chalkModule.default.yellow;
    error = chalkModule.default.red;
  }
} catch {
  // Silently fall back to no colors
}

export class StorageConfig {
  /**
   * Load storage provider configuration from the project
   * @param {string} projectRoot - Project root directory (contains semantqQL folder)
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Storage provider configuration
   */
  static async load(projectRoot, options = {}) {
    try {
      console.log(info(`Loading storage config from project root: ${projectRoot}`));
      
      // Check for environment variables first (highest priority)
      const envConfig = this.loadFromEnv();
      if (Object.keys(envConfig).length > 0 && options.preferEnv !== false) {
        console.log(success('Loaded configuration from environment variables'));
        return this.normalizeConfig(envConfig);
      }
      
      // Try to use the existing semantqQL config loader
      const config = await this.trySemantqConfig(projectRoot);
      if (config) {
        return this.normalizeConfig(config);
      }
      
      // Fallback: load directly from server.config.js
      const directConfig = await this.loadDirectConfig(projectRoot);
      return this.normalizeConfig(directConfig);
      
    } catch (err) {
      if (options.throwOnError) {
        throw err;
      }
      console.warn(warning('Storage config loading failed:'), err.message);
      return this.getDefaultConfig();
    }
  }
  
  /**
   * Load configuration from environment variables
   * @returns {Object} Environment-based config
   */
  static loadFromEnv() {
    const config = {};
    
    // Provider
    if (process.env.STORAGE_PROVIDER) {
      config.provider = process.env.STORAGE_PROVIDER;
    }
    
    // General settings
    if (process.env.STORAGE_MAX_FILE_SIZE) {
      config.maxFileSize = process.env.STORAGE_MAX_FILE_SIZE;
    }
    if (process.env.STORAGE_MAX_FILES) {
      config.maxFiles = parseInt(process.env.STORAGE_MAX_FILES, 10);
    }
    if (process.env.STORAGE_DEFAULT_FOLDER) {
      config.defaultFolder = process.env.STORAGE_DEFAULT_FOLDER;
    }
    
    // UploadThing
    if (process.env.UPLOADTHING_TOKEN || process.env.UPLOADTHING_APP_ID) {
      config.uploadthing = {
        token: process.env.UPLOADTHING_TOKEN,
        appId: process.env.UPLOADTHING_APP_ID,
        ...(process.env.UPLOADTHING_REGION && { region: process.env.UPLOADTHING_REGION })
      };
    }
    
    // AWS S3
    if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_S3_BUCKET) {
      config.s3 = {
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        endpoint: process.env.AWS_ENDPOINT,
        cdnUrl: process.env.AWS_CDN_URL,
        ...(process.env.AWS_FORCE_PATH_STYLE && { forcePathStyle: process.env.AWS_FORCE_PATH_STYLE === 'true' })
      };
    }
    
    // Cloudinary
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      config.cloudinary = {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        ...(process.env.CLOUDINARY_FOLDER && { folder: process.env.CLOUDINARY_FOLDER })
      };
    }
    
    return config;
  }
  
  /**
   * Try to use existing semantqQL config loader
   */
  static async trySemantqConfig(projectRoot) {
    try {
      const semantqQLDir = join(projectRoot, 'semantqQL');
      const configPath = join(semantqQLDir, 'config_loader.js');
      const serverConfigPath = join(semantqQLDir, 'server.config.js');
      
      // Check if semantqQL directory and config files exist
      if (fs.existsSync(semantqQLDir)) {
        // Try config_loader.js first
        if (fs.existsSync(configPath)) {
          const configUrl = pathToFileURL(configPath).href;
          const loader = await import(configUrl);
          const getConfig = loader.default || loader.getConfig;
          
          if (typeof getConfig === 'function') {
            const fullConfig = await getConfig();
            if (fullConfig.storage) {
              console.log(success('Loaded via semantqQL config loader'));
              return fullConfig.storage;
            }
          }
        }
        
        // Fall back to server.config.js
        if (fs.existsSync(serverConfigPath)) {
          const configUrl = pathToFileURL(serverConfigPath).href;
          const configModule = await import(configUrl);
          const fullConfig = configModule.default || configModule;
          
          if (fullConfig.storage) {
            console.log(success('Loaded via semantqQL server.config.js'));
            return fullConfig.storage;
          }
        }
      } else {
        console.log(info('semantqQL directory not found'));
      }
    } catch (err) {
      console.log(info('Could not use semantqQL config loader:'), err.message);
    }
    return null;
  }
  
  /**
   * Load config directly from server.config.js in semantqQL directory
   */
  static async loadDirectConfig(projectRoot) {
    const semantqQLDir = join(projectRoot, 'semantqQL');
    const configPath = join(semantqQLDir, 'server.config.js');
    
    // Check if semantqQL directory exists
    if (!fs.existsSync(semantqQLDir)) {
      throw new Error(`semantqQL directory not found at: ${semantqQLDir}`);
    }
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`server.config.js not found at: ${configPath}`);
    }
    
    try {
      const configUrl = pathToFileURL(configPath).href;
      const configModule = await import(configUrl);
      const config = configModule.default || configModule;
      
      if (!config.storage) {
        console.warn(warning('No storage configuration found in server.config.js'));
        return {};
      }
      
      console.log(success(`Loaded storage config from: ${configPath}`));
      return config.storage;
      
    } catch (err) {
      throw new Error(`Failed to load server.config.js: ${err.message}`);
    }
  }
  
  /**
   * Load configuration from a specific file path
   * @param {string} configPath - Path to config file
   * @returns {Promise<Object>} Loaded configuration
   */
  static async loadFromFile(configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    
    try {
      const configUrl = pathToFileURL(configPath).href;
      const configModule = await import(configUrl);
      const config = configModule.default || configModule;
      
      return this.normalizeConfig(config.storage || config);
    } catch (err) {
      throw new Error(`Failed to load config from ${configPath}: ${err.message}`);
    }
  }
  
  /**
   * Normalize and validate the config
   */
  static normalizeConfig(rawConfig) {
    // Parse maxFileSize if it's a string
    const maxFileSize = rawConfig.maxFileSize 
      ? (typeof rawConfig.maxFileSize === 'string' 
          ? parseSize(rawConfig.maxFileSize) 
          : rawConfig.maxFileSize)
      : parseSize('50MB');
    
    const config = {
      provider: rawConfig.provider || process.env.STORAGE_PROVIDER || 'uploadthing',
      maxFileSize,
      maxFileSizeReadable: typeof rawConfig.maxFileSize === 'string' 
        ? rawConfig.maxFileSize 
        : formatBytes(maxFileSize),
      maxFiles: rawConfig.maxFiles || parseInt(process.env.STORAGE_MAX_FILES || '20', 10),
      defaultFolder: rawConfig.defaultFolder || process.env.STORAGE_DEFAULT_FOLDER || 'uploads',
      
      // Provider-specific configs
      uploadthing: {
        token: rawConfig.uploadthing?.token || process.env.UPLOADTHING_TOKEN || '',
        appId: rawConfig.uploadthing?.appId || process.env.UPLOADTHING_APP_ID || '',
        ...(rawConfig.uploadthing || {})
      },
      s3: {
        region: rawConfig.s3?.region || process.env.AWS_REGION || 'us-east-1',
        bucket: rawConfig.s3?.bucket || process.env.AWS_S3_BUCKET || '',
        accessKeyId: rawConfig.s3?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: rawConfig.s3?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
        cdnUrl: rawConfig.s3?.cdnUrl || process.env.AWS_CDN_URL || '',
        endpoint: rawConfig.s3?.endpoint || process.env.AWS_ENDPOINT || '',
        forcePathStyle: rawConfig.s3?.forcePathStyle || process.env.AWS_FORCE_PATH_STYLE === 'true',
        ...(rawConfig.s3 || {})
      },
      cloudinary: {
        cloud_name: rawConfig.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || '',
        api_key: rawConfig.cloudinary?.api_key || process.env.CLOUDINARY_API_KEY || '',
        api_secret: rawConfig.cloudinary?.api_secret || process.env.CLOUDINARY_API_SECRET || '',
        folder: rawConfig.cloudinary?.folder || process.env.CLOUDINARY_FOLDER || '',
        ...(rawConfig.cloudinary || {})
      }
    };
    
    // Log the provider being used
    console.log(info(`Storage provider: ${config.provider}`));
    console.log(info(`Max file size: ${config.maxFileSizeReadable}`));
    
    // Validate required fields for selected provider
    this.validateProviderConfig(config);
    
    return config;
  }
  
  /**
   * Validate provider-specific required fields
   */
  static validateProviderConfig(config) {
    const provider = config.provider?.toLowerCase();
    
    switch (provider) {
      case 'uploadthing':
        if (!config.uploadthing.token) {
          console.warn(warning('UploadThing token not configured. Set UPLOADTHING_TOKEN env var or in config.'));
        }
        break;
      case 's3':
      case 'aws':
        if (!config.s3.bucket) {
          console.warn(warning('S3 bucket not configured. Set AWS_S3_BUCKET env var or in config.'));
        }
        if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
          console.warn(warning('S3 credentials not fully configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'));
        }
        break;
      case 'cloudinary':
        if (!config.cloudinary.cloud_name) {
          console.warn(warning('Cloudinary cloud name not configured. Set CLOUDINARY_CLOUD_NAME env var or in config.'));
        }
        break;
      default:
        console.warn(warning(`Unknown provider: ${provider}`));
    }
  }
  
  /**
   * Get default configuration
   */
  static getDefaultConfig() {
    console.warn(warning('Using default storage configuration'));
    
    return this.normalizeConfig({
      provider: 'uploadthing',
      maxFileSize: '50MB',
      maxFiles: 20,
      defaultFolder: 'uploads'
    });
  }
  
  /**
   * Merge multiple configs (cli > env > file > defaults)
   * @param {...Object} configs - Config objects in priority order
   * @returns {Object} Merged config
   */
  static merge(...configs) {
    const merged = {};
    
    for (const config of configs) {
      if (!config) continue;
      
      // Deep merge
      Object.assign(merged, config);
      
      // Merge provider configs
      for (const provider of ['uploadthing', 's3', 'cloudinary']) {
        if (config[provider]) {
          merged[provider] = {
            ...merged[provider],
            ...config[provider]
          };
        }
      }
    }
    
    return this.normalizeConfig(merged);
  }
  
  /**
   * Check if configuration is valid for use
   * @param {Object} config - Config to validate
   * @returns {boolean} True if valid
   */
  static isValid(config) {
    try {
      this.validateProviderConfig(config);
      
      // Basic required fields
      if (!config.provider) return false;
      if (!config.maxFileSize) return false;
      
      return true;
    } catch {
      return false;
    }
  }
}

// Helper for formatting bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default StorageConfig;