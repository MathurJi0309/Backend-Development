import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs'; 

    // Configuration
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dm5w4wjgr', 
        api_key: process.env.CLOUDINARY_API_KEY || '923276459693242', 
        api_secret: process.env.CLOUDINARY_API_SECRET || '<your_api_secret>' // Click 'View API Keys' above to copy your API secret
    });

    const uploadOnCloudinary = async (localFilePath) => {
        try {
            if(!fs.existsSync(localFilePath)) {
                throw new Error(`File not found: ${localFilePath}`);
            }

            const result = await cloudinary.uploader.upload(localFilePath, {
                resource_type: 'auto', 
            
            });
            console.log('Upload successful:', result);
            return result;
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            fs.unlinkSync(localFilePath) //remove the file from local storage after uploading to cloudinary
            return null;
        }
    }


export {uploadOnCloudinary};