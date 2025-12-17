//providers/s3.js
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default class S3Provider {
  constructor(config = {}) {
    this.s3 = new S3Client({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      }
    });
    
    this.bucket = config.bucket || process.env.AWS_S3_BUCKET;
    this.cdnUrl = config.cdnUrl || process.env.AWS_CDN_URL;
  }
  
  async upload(file, options = {}) {
    const { originalname, buffer, mimetype, size } = file;
    const folder = options.folder || 'uploads';
    
    // Generate unique filename
    const timestamp = Date.now();
    const safeName = originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}-${safeName}`;
    
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      Metadata: options.metadata || {}
    }));
    
    // Generate URL (CDN if configured, otherwise S3 direct)
    const url = this.cdnUrl 
      ? `${this.cdnUrl}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;
    
    return {
      url,
      key,
      name: originalname,
      size,
      type: mimetype,
      provider: 's3'
    };
  }
  
  async delete(url) {
    // Extract key from URL
    let key;
    
    if (url.includes('.s3.amazonaws.com/')) {
      key = url.split('.s3.amazonaws.com/')[1];
    } else if (this.cdnUrl && url.startsWith(this.cdnUrl)) {
      key = url.replace(`${this.cdnUrl}/`, '');
    } else {
      // Try to parse from any URL
      const urlObj = new URL(url);
      key = urlObj.pathname.substring(1); // Remove leading slash
    }
    
    if (!key) throw new Error('Could not extract key from URL');
    
    return this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));
  }
}