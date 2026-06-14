import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (fileBuffer, mimetype) => {
  try {
    if (!fileBuffer) return null;
    
    // Convert buffer to data URI
    const b64 = Buffer.from(fileBuffer).toString("base64");
    const dataURI = "data:" + mimetype + ";base64," + b64;
    
    const response = await cloudinary.uploader.upload(dataURI, {
      resource_type: "auto",
      folder: "nubred_blogs",
    });
    
    return response;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    return null;
  }
};
