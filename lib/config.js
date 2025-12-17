// @semantql/storage/lib/config.js
import { pathToFileURL } from 'url';
import { join } from 'path';
import fs from 'fs';
import chalk from 'chalk';

// Colors for console
const success = chalk.green;
const info = chalk.blue;
const warning = chalk.yellow;
const error = chalk.red;

export class StorageConfig {
  /**
   * Load storage provider configuration from the project
   * @param {string} projectRoot - Project root directory (contains semantqQL folder)
   * @returns {Promise<Object>} Storage provider configuration
   */
  static async load(projectRoot) {
    try {
      console.log(info(`Loading storage config from project root: ${projectRoot}`));
      
      // Try to use the existing semantqQL config loader
      const config = await this.trySemantqConfig(projectRoot);
      if (config) {
        return this.normalizeConfig(config);
      }
      
      // Fallback: load directly from server.config.js
      const directConfig = await this.loadDirectConfig(projectRoot);
      return this.normalizeConfig(directConfig);
      
    } catch (err) {
      console.warn(warning('Storage config loading failed:'), err.message);
      return this.getDefaultConfig();
    }
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
      if (fs.existsSync(semantqQLDir) && fs.existsSync(configPath) && fs.existsSync(serverConfigPath)) {
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
      } else {
        console.log(info('semantqQL directory or config files not found'));
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
   * Normalize and validate the config
   */
  static normalizeConfig(rawConfig) {
    const config = {
      provider: rawConfig.provider || process.env.STORAGE_PROVIDER || 'uploadthing',
      maxFileSize: rawConfig.maxFileSize || process.env.STORAGE_MAX_FILE_SIZE || 50 * 1024 * 1024,
      maxFiles: rawConfig.maxFiles || process.env.STORAGE_MAX_FILES || 20,
      defaultFolder: rawConfig.defaultFolder || process.env.STORAGE_DEFAULT_FOLDER || 'uploads',
      // Copy provider-specific configs
      ...rawConfig
    };
    
    // Log the provider being used
    console.log(info(`Storage provider: ${config.provider}`));
    
    return config;
  }
  
  /**
   * Get default configuration
   */
  static getDefaultConfig() {
    console.warn(warning('Using default storage configuration'));
    
    return {
      provider: 'uploadthing',
      maxFileSize: 50 * 1024 * 1024,
      maxFiles: 20,
      defaultFolder: 'uploads',
      uploadthing: {
        token: process.env.UPLOADTHING_TOKEN || '',
        appId: process.env.UPLOADTHING_APP_ID || '',
      },
      s3: {
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET || '',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        cdnUrl: process.env.AWS_CDN_URL || '',
      }
    };
  }
}

export default StorageConfig;