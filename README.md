# @semantq/storage

File storage module for semantqQL — the Node.js backend of the semantq framework.

Organizes files by model record structure (e.g., `product/1/images/`) and provides a unified API across multiple storage providers.

## Installation

```bash
npm install @semantq/storage
```

## Quick Start

```js
import { Storage } from '@semantq/storage';

// Upload a file (from multer, Buffer, or File object)
const result = await Storage.upload(fileBuffer, {
  organizationId: 1,
  modelName: 'ProjectFile',
  recordId: 'abc-123',
  fieldKey: 'fileUrl',
  originalName: 'document.pdf',
  mimeType: 'application/pdf'
});

// result: { storageKey, publicUrl, fileSize, fileHash, metadata }

// Get a public URL
const url = await Storage.getUrl(result.storageKey);

// Check if file exists
const exists = await Storage.exists(result.storageKey);

// Get file as buffer
const buffer = await Storage.getBuffer(result.storageKey);

// Delete file
await Storage.delete(result.storageKey);
```

## API

### `Storage.upload(file, metadata)`

Upload a file. Accepts a `Buffer`, multer file object, or browser `File` instance.

| Option | Type | Required | Description |
|---|---|---|---|
| `organizationId` | string/number | Yes | Organization ID |
| `modelName` | string | Yes | Model name (e.g., `ProjectFile`, `Budget`) |
| `recordId` | string | Yes | Record UUID |
| `fieldKey` | string | Yes | Field name (e.g., `fileUrl`) |
| `originalName` | string | No | Original filename |
| `mimeType` | string | No | File MIME type |

Returns: `{ storageKey, publicUrl, fileSize, fileHash, metadata }`

### `Storage.delete(storageKey)`

Delete a file from storage. Returns `boolean`.

### `Storage.getUrl(storageKey)`

Get the public URL for a file. Returns `string`.

### `Storage.getBuffer(storageKey)`

Download file as a Buffer. Returns `Buffer`.

### `Storage.exists(storageKey)`

Check if file exists in storage. Returns `boolean`.

## Storage Key Structure

Files are stored with a structured path pattern:

```
{organizationId}/{modelName}/{recordId}/{fieldKey}/{filename}
```

Example:
```
1/projectfile/abc-123/fileurl/document_1711234567890_a1b2c3.pdf
```

## Providers

### Local (Default)

Stores files on the local filesystem. Configure in `server.config.js`:

```js
storage: {
  activeProvider: 'local',
  local: {
    uploadDir: './uploads',
    baseUrl: '/uploads'
  }
}
```

### UploadThing (Planned)

Cloud storage via UploadThing. Falls back to local provider when no token is configured.

### S3 (Coming Soon)

AWS S3 provider.

### Cloudinary (Coming Soon)

Cloudinary provider.

## Configuration

All storage configuration lives in your SemantQQL `server.config.js` under the `storage` key:

```js
export default {
  storage: {
    activeProvider: 'local',    // 'local' | 'uploadthing' | 's3' | 'cloudinary'
    local: {
      uploadDir: './uploads',
      baseUrl: '/uploads'
    },
    uploadthing: {
      token: process.env.UPLOADTHING_TOKEN,
      appId: process.env.UPLOADTHING_APP_ID
    }
    // s3: { ... }        (coming soon)
    // cloudinary: { ... } (coming soon)
  }
}
```

## Usage in Services

```js
import { Storage } from '@semantq/storage';

class ProjectFileService {
  async uploadFile(req) {
    const file = req.file;
    const userData = req.userData;

    const result = await Storage.upload(file, {
      organizationId: userData.organizationId,
      modelName: 'ProjectFile',
      recordId: req.body.projectId,
      fieldKey: 'fileUrl',
      originalName: file.originalname,
      mimeType: file.mimetype
    });

    // Save result.storageKey and result.publicUrl to your database
    await ProjectFileModel.create({
      filename: file.originalname,
      fileUrl: result.publicUrl,
      fileKey: result.storageKey,
      // ... other fields
    });
  }

  async deleteFile(fileId) {
    const file = await ProjectFileModel.findById(fileId);
    if (file?.fileKey) {
      await Storage.delete(file.fileKey);
    }
    await ProjectFileModel.delete(fileId);
  }
}
```

## Extending

To add a new provider, extend `BaseStorageProvider`:

```js
import { BaseStorageProvider } from '@semantq/storage';

class MyProvider extends BaseStorageProvider {
  constructor(config) {
    super(config);
    this.name = 'myprovider';
  }

  async upload(fileBuffer, options) { /* ... */ }
  async delete(storageKey) { /* ... */ }
  async getUrl(storageKey) { /* ... */ }
  async exists(storageKey) { /* ... */ }
  async getBuffer(storageKey) { /* ... */ }
}
```

## License

MIT
