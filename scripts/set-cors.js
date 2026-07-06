const { BlobServiceClient } = require('@azure/storage-blob');

const connStr = 'process.env.AZURE_STORAGE_CONNECTION_STRING';

const client = BlobServiceClient.fromConnectionString(connStr);
client.setProperties({
  cors: [
    {
      allowedOrigins: 'http://localhost:5173,http://localhost:5174',
      allowedMethods: 'GET,PUT,DELETE,HEAD,OPTIONS,POST',
      allowedHeaders: 'x-ms-blob-type,Content-Type,Authorization,x-ms-version,x-ms-date,x-ms-client-request-id,x-ms-content-length',
      exposedHeaders: 'ETag,Content-Length,Content-MD5,x-ms-request-id',
      maxAgeInSeconds: 3600
    }
  ]
}).then(() => {
  console.log('CORS rules set successfully');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
