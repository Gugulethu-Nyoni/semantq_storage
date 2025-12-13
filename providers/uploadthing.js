import { UTApi } from 'uploadthing/server';

export default class UploadThingProvider {
  constructor(config = {}) {
    this.utapi = new UTApi({
      token: config.token || process.env.UPLOADTHING_TOKEN,
    });
    this.config = config;
  }
  
  async upload(file, options = {}) {
    const { originalname, buffer, mimetype, size } = file;
    const folder = options.folder || 'uploads';
    
    // Convert buffer to File for UploadThing
    const blob = new Blob([buffer], { type: mimetype });
    const uploadFile = new File([blob], originalname, { 
      type: mimetype,
      lastModified: Date.now()
    });
    
    const response = await this.utapi.uploadFiles([uploadFile], {
      metadata: {
        folder,
        ...options.metadata
      }
    });
    
    if (!response.data?.[0]?.url) {
      throw new Error('Upload failed: No URL returned');
    }
    
    return {
      url: response.data[0].url,
      key: response.data[0].key,
      name: originalname,
      size,
      type: mimetype,
      provider: 'uploadthing'
    };
  }
  
  async delete(url) {
    // Extract key from UploadThing URL
    const key = url.split('/f/')[1];
    if (!key) throw new Error('Invalid UploadThing URL');
    
    return this.utapi.deleteFiles([key]);
  }
}