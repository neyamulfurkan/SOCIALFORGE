// src/lib/cloudinary.ts

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function generateUploadSignature(folder: string): Promise<{
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  uploadPreset: string;
}> {
  const timestamp = Math.floor(Date.now() / 1000);
  // Only sign folder and timestamp — do NOT include upload_preset in signed
  // params because the client sends it as an unsigned field separately.
  // Including it here but not in the client request causes signature mismatch.
  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET as string,
  );

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    folder,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET as string,
  };
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error for', publicId, error);
  }
}