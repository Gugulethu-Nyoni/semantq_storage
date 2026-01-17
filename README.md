
# @semantq/storage

A lightweight, provider-agnostic file storage solution for Node.js applications. Easily handle file uploads, storage, and management across multiple providers (UploadThing, AWS S3, Cloudinary) with a unified API. Integrates seamlessly with semantqQL (full stack) or backend projects.

## Features

- **Provider Agnostic**: Switch between UploadThing, AWS S3, and Cloudinary with zero code changes
- **Express Middleware**: Built-in multer middleware for handling single and multiple file uploads
- **Model-First Approach**: Integrate file storage directly with your data models
- **Type Safety**: Full MIME type validation with category support (images, documents, etc.)
- **Automatic Cleanup**: Delete associated files when records are removed/deleted
- **Smart Config**: Auto-loads configuration from your Semantq project
- **File Replacement**: Automatically clean up old files when new ones are uploaded

## Installation

```bash
npm install @semantq/storage
```

OR

```bash
npm i @semantq/storage
```

## Quick Start

### 1. Configure Your Provider

In your `semantqQL/server.config.js`:

```javascript
export default {
  // ... other config
  storage: {
    provider: 'uploadthing', // 's3' or 'cloudinary'
    maxFileSize: 50 * 1024 * 1024, // 50MB
    
    // UploadThing config
    uploadthing: {
      token: process.env.UPLOADTHING_TOKEN,
      appId: process.env.UPLOADTHING_APP_ID,
    },
    
    // AWS S3 config (alternative)
    s3: {
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_S3_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      cdnUrl: process.env.AWS_CDN_URL, // optional CDN
    }
  }
}
```

### 2. Create a Storage-Integrated Service

```javascript
import { createModelFileService } from '@semantq/storage';

// Define your file field configuration
const productFileConfig = {
  fileFields: {
    mainImage: {
      allowedCategories: ['image'],
      maxCount: 1,
      maxSize: '5MB'
    },
    galleryImages: {
      allowedCategories: ['image'],
      maxCount: 10,
      maxSize: '10MB'
    },
    specSheet: {
      allowedCategories: ['document'],
      maxCount: 1,
      maxSize: '20MB'
    }
  },
  folderTemplate: 'products/{id}' // Files organized by product ID
};

// Create file service for your model
const productFileService = createModelFileService('Product', productFileConfig);

// Use in your routes
app.post('/products', productFileService.getUploadMiddleware(), async (req, res) => {
  try {
    // Process uploaded files
    const fileUrls = await productFileService.processFiles(req, { id: 'new' });
    
    // Save to database with file URLs
    const product = await Product.create({
      ...req.body,
      ...fileUrls
    });
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Core Concepts

### 1. **ModelFileService**
The heart of the storage system. Each model (Product, User, Post) gets its own service:

```javascript
const userFileService = createModelFileService('User', {
  fileFields: {
    avatar: { allowedCategories: ['image'], maxCount: 1 },
    documents: { allowedCategories: ['document'], maxCount: 5 }
  },
  folderTemplate: 'users/{id}'
});
```

### 2. **File Field Configuration**
Define validation rules per field:

```javascript
{
  fieldName: {
    allowedCategories: ['image', 'document'], // MIME categories
    allowedTypes: ['image/png', 'application/pdf'], // Specific MIME types
    disallowedTypes: ['application/exe'], // Block specific types
    maxCount: 5, // Maximum files per field
    maxSize: '10MB', // Max file size
    metadata: { purpose: 'profile' } // Custom metadata
  }
}
```

### 3. **MIME Categories**
Pre-defined categories for easy validation:
- `image`: JPEG, PNG, WebP, GIF, SVG, etc.
- `document`: PDF, DOC, DOCX, RTF, TXT
- `spreadsheet`: XLS, XLSX, CSV, ODS
- `presentation`: PPT, PPTX, ODP
- `audio`: MP3, WAV, OGG, M4A
- `video`: MP4, WebM, MOV, AVI
- `archive`: ZIP, RAR, TAR, GZIP
- `code`: JS, Python, Java, PHP, JSON, XML, HTML, CSS

## API Reference

### Core Exports

```javascript
import {
  createModelFileService,  // Create model-specific file service
  ModelFileService,        // Main service class
  createUploadMiddleware,  // Express middleware generator
  StorageConfig,          // Configuration loader
  MIME_CATEGORIES,        // Pre-defined MIME categories
  validateFile,           // File validation utility
  expandCategories        // Convert categories to MIME types
} from '@semantq/storage';
```

### ModelFileService Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getUploadMiddleware()` | Express middleware for the model's file fields | `Array` of middleware |
| `processFiles(req, context)` | Process uploaded files from request | `Promise<Object>` file URLs |
| `deleteFiles(record)` | Delete all files associated with a record | `Promise<void>` |
| `cleanupReplacedFiles(existing, newFiles)` | Clean up old files being replaced | `Promise<void>` |

### Express Middleware

```javascript
// Single route with file handling
app.post('/upload', 
  productFileService.getUploadMiddleware(),
  async (req, res) => {
    const files = await productFileService.processFiles(req);
    res.json(files);
  }
);
```

### File Processing

```javascript
// Process files with context (like record ID)
const fileUrls = await fileService.processFiles(req, { 
  id: productId,
  type: 'premium'
});

// Result: { mainImage: 'https://...', galleryImages: ['https://...'] }
```

## 🏗️ Advanced Usage

### 1. **CRUD Integration Pattern**

```javascript
import { createStorageIntegratedService } from '@semantq/storage';

// Wrap your existing service
const enhancedProductService = createStorageIntegratedService(
  productService,     // Your base CRUD service
  'Product',         // Model name
  productFileConfig  // File configuration
);

// Use enhanced service
router.post('/products', 
  enhancedProductService.getUploadMiddleware(),
  async (req, res) => {
    const product = await enhancedProductService.create(req.body, req);
    res.json(product);
  }
);

router.put('/products/:id',
  enhancedProductService.getUploadMiddleware(),
  async (req, res) => {
    const product = await enhancedProductService.update(req.params.id, req.body, req);
    res.json(product);
  }
);

router.delete('/products/:id', async (req, res) => {
  // Automatically deletes associated files
  await enhancedProductService.delete(req.params.id);
  res.json({ success: true });
});
```

### 2. **Custom Folder Structure**

```javascript
const blogFileConfig = {
  fileFields: {
    featuredImage: { allowedCategories: ['image'] },
    attachments: { allowedCategories: ['document', 'archive'] }
  },
  folderTemplate: 'blog/{year}/{month}/{slug}'
};

// Usage with dynamic context
const fileUrls = await blogFileService.processFiles(req, {
  year: '2024',
  month: '12',
  slug: 'getting-started-with-storage'
});
```

### 3. **Direct Storage Usage**

```javascript
import { createStorage } from '@semantq/storage';

// Direct storage operations
const storage = createStorage();
const result = await storage.upload(file, {
  folder: 'temp',
  allowedTypes: ['image/*'],
  metadata: { userId: 123 }
});

await storage.delete(result.url);
```

## Security & Validation

### File Validation
```javascript
import { validateFile } from '@semantq/storage';

// Manual validation
try {
  validateFile(file, {
    maxSize: '10MB',
    allowedCategories: ['image'],
    disallowedTypes: ['image/gif'] // Block GIFs specifically
  });
} catch (error) {
  console.error('Invalid file:', error.message);
}
```

### Security Best Practices
1. **Always validate MIME types** - don't trust file extensions
2. **Set reasonable size limits** per use case
3. **Use categories** for broader validation
4. **Implement rate limiting** on upload endpoints
5. **Sanitize filenames** to prevent path traversal

## Provider Configuration

### UploadThing
```javascript
storage: {
  provider: 'uploadthing',
  uploadthing: {
    token: process.env.UPLOADTHING_TOKEN,
    appId: process.env.UPLOADTHING_APP_ID
  }
}
```

### AWS S3
```javascript
storage: {
  provider: 's3',
  s3: {
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    cdnUrl: process.env.AWS_CDN_URL // Optional
  }
}
```

### Cloudinary (Example)
```javascript
storage: {
  provider: 'cloudinary',
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  }
}
```

## Troubleshooting

### Common Issues

1. **"Provider not supported"**
   - Check provider name spelling (lowercase)
   - Ensure provider config exists in server.config.js

2. **"File too large"**
   - Increase `maxFileSize` in config
   - Check client-side validation matches server

3. **"Invalid file type"**
   - Verify MIME type is in allowed categories
   - Use `MIME_CATEGORIES` constant for reference

4. **"semantqQL directory not found"**
   - Ensure you're running from project root
   - Config loader looks for `semantqQL/server.config.js`

### Debug Mode
```javascript
storage: {
  provider: 'uploadthing',
  debug: true // Enables verbose (error) logging for debugging
}
```

## Examples

### Full Product CRUD Example
See `templates/storage-integrated-service.js` for a complete implementation pattern.

### Image Upload Only
```javascript
const avatarService = createModelFileService('User', {
  fileFields: {
    avatar: {
      allowedCategories: ['image'],
      maxCount: 1,
      maxSize: '2MB'
    }
  }
});

app.post('/avatar', avatarService.getUploadMiddleware(), async (req, res) => {
  const { avatar } = await avatarService.processFiles(req, { id: req.user.id });
  await User.update(req.user.id, { avatar });
  res.json({ avatar });
});
```

## Related Packages

- `@semantq/mail` - Plug and play Email service with templating
- `@semantq/auth` - User Management/Authentication utilities (sign up, email verification, login, password recovery)

## License

## TODO


MIT © Gugulethu Nyoni

## Support

- Issues: [GitHub Issues](https://github.com/semantq/storage/issues)
- Documentation: [Readme](https://github.com/semantq/storage#readme)
- Examples: `/examples` directory


**Built for the semantq ecosystem** · **Simple · Flexible · Powerful**


Semantq is open-source software licensed under the **MIT License**.

## Semantq Main Documentation: [Semantq](https://github.com/Gugulethu-Nyoni/semantq).

