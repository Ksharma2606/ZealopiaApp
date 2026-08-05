import { Platform } from 'react-native';
import ApiService from './ApiService';

export interface FileUploadRequest {
  file_name: string;
  file_size: number;
  file_type: string;
  group_id: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface FileUploadResponse {
  attachment_id: string;
  presigned_url: string;
  public_url: string;
  expires_at: string;
  s3_key: string;
  attachment_type: 'image' | 'audio' | 'video';
  file_name: string;
  file_size: number;
  file_type: string;
  // Note: duration is not returned by backend, we preserve it from the request
}

export interface AttachmentData {
  id: string;
  type: 'image' | 'audio' | 'video';
  url: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  transcription?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionConfidence?: number;
}

export interface UploadProgressCallback {
  (progress: number): void;
}

class FileUploadService {
  /**
   * Upload a file to S3 via presigned URL
   */
  async uploadFile(
    fileUri: string,
    uploadRequest: FileUploadRequest,
    onProgress?: UploadProgressCallback
  ): Promise<AttachmentData> {
    try {
      // Step 1: Get presigned URL from backend
      const response = await ApiService.getPresignedUploadUrl(uploadRequest);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get presigned URL');
      }

      const {
        attachment_id,
        presigned_url,
        public_url,
        attachment_type,
        file_name,
        file_size
      } = response.data;

      // Step 2: Upload file to S3 using presigned URL
      await this.uploadToS3(fileUri, presigned_url, uploadRequest.file_type, onProgress);

      // Step 3: Mark attachment as uploaded (for cleanup tracking)
      await this.markAttachmentUploaded(attachment_id);

      // Step 4: Return attachment data for Firebase message
      const attachmentData: AttachmentData = {
        id: attachment_id,
        type: attachment_type,
        url: public_url,
        fileName: file_name,
        fileSize: file_size,
      };

      // Only add optional fields if they have values (Firebase doesn't allow undefined)
      // Use values from the original request since backend doesn't return them
      if (uploadRequest.width !== undefined) attachmentData.width = uploadRequest.width;
      if (uploadRequest.height !== undefined) attachmentData.height = uploadRequest.height;
      if (uploadRequest.duration !== undefined) attachmentData.duration = uploadRequest.duration;

      return attachmentData;

    } catch (error) {
      console.error('File upload failed:', error);
      throw new Error(`File upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Upload file to S3 using presigned URL
   */
  private async uploadToS3(
    fileUri: string,
    presignedUrl: string,
    contentType: string,
    onProgress?: UploadProgressCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed with status: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('S3 upload failed'));
      };

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', contentType);

      // For React Native, we need to handle file upload differently
      // Convert file URI to blob for web or use direct upload for mobile
      if (Platform.OS === 'web') {
        // Web implementation - send raw blob data
        fetch(fileUri)
          .then(response => response.blob())
          .then(blob => {
            xhr.send(blob);
          })
          .catch(reject);
      } else {
        // Mobile implementation - use fetch with FormData
        this.uploadToS3Mobile(fileUri, presignedUrl, contentType, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }
    });
  }

  /**
   * Mobile-specific S3 upload using fetch
   */
  private async uploadToS3Mobile(
    fileUri: string,
    presignedUrl: string,
    contentType: string,
    onProgress?: UploadProgressCallback
  ): Promise<void> {
    // For React Native, we need to read the file and send raw binary data
    // S3 presigned PUT URLs expect the raw file content, not FormData
    const FileSystem = require('expo-file-system');
    
    console.log('Uploading file to S3:', { fileUri, contentType });
    
    try {
      // For React Native, we can upload the file directly using the URI
      // expo-file-system's uploadAsync handles binary data correctly
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, fileUri, {
        httpMethod: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      console.log('Upload result:', uploadResult);

      if (uploadResult.status !== 200) {
        console.error('S3 upload failed:', uploadResult);
        throw new Error(`S3 upload failed with status: ${uploadResult.status}`);
      }
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Mark attachment as uploaded for cleanup tracking
   */
  private async markAttachmentUploaded(attachmentId: string, messageId?: string): Promise<void> {
    try {
      const response = await ApiService.markAttachmentUploaded(attachmentId, messageId);
      if (!response.success) {
        console.warn('Failed to mark attachment as uploaded:', response.error);
      }
    } catch (error) {
      // Non-critical error, just log it
      console.warn('Failed to mark attachment as uploaded:', error);
    }
  }

  /**
   * Get file info from URI (for mobile)
   */
  async getFileInfo(fileUri: string): Promise<{
    name: string;
    size: number;
    type: string;
  }> {
    if (Platform.OS === 'web') {
      // Web implementation
      const response = await fetch(fileUri);
      const blob = await response.blob();
      return {
        name: 'file',
        size: blob.size,
        type: blob.type
      };
    } else {
      // Mobile implementation using expo-file-system
      const FileSystem = require('expo-file-system');
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      // Get file name from URI
      const fileName = fileUri.split('/').pop() || 'file';
      
      // Determine MIME type from extension
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeType = this.getMimeTypeFromExtension(extension);
      
      return {
        name: fileName,
        size: fileInfo.size || 0,
        type: mimeType
      };
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension?: string): string {
    const mimeTypes: { [key: string]: string } = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      heic: 'image/heic',
      
      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      aac: 'audio/aac',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      
      // Video
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm'
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Validate file before upload
   */
  validateFile(fileName: string, fileSize: number, fileType: string): {
    isValid: boolean;
    error?: string;
  } {
    // Size limits (in bytes)
    const MAX_SIZES = {
      image: 10 * 1024 * 1024, // 10MB
      audio: 50 * 1024 * 1024, // 50MB
      video: 100 * 1024 * 1024 // 100MB
    };

    // Allowed extensions
    const ALLOWED_EXTENSIONS = {
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
      audio: ['mp3', 'wav', 'aac', 'm4a', 'ogg'],
      video: ['mp4', 'mov', 'avi', 'mkv', 'webm']
    };

    // Get file extension
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) {
      return { isValid: false, error: 'File must have an extension' };
    }

    // Determine file type
    let fileCategory: 'image' | 'audio' | 'video' | null = null;
    for (const [category, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
      if (extensions.includes(extension)) {
        fileCategory = category as 'image' | 'audio' | 'video';
        break;
      }
    }

    if (!fileCategory) {
      return { isValid: false, error: `Unsupported file type: ${extension}` };
    }

    // Check file size
    if (fileSize > MAX_SIZES[fileCategory]) {
      const maxSizeMB = MAX_SIZES[fileCategory] / (1024 * 1024);
      return { 
        isValid: false, 
        error: `File size exceeds ${maxSizeMB}MB limit for ${fileCategory} files` 
      };
    }

    // Check MIME type matches extension
    if (!fileType.startsWith(fileCategory)) {
      return { 
        isValid: false, 
        error: `File type mismatch: ${fileType} doesn't match ${extension}` 
      };
    }

    return { isValid: true };
  }
}

export default new FileUploadService();