const { connectDB } = require('../utils/db');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// media upload handler
module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // verify authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // handle file upload with multer
    upload.single('media')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        // upload to cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'socialx-media',
              resource_type: 'auto',
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          
          uploadStream.end(req.file.buffer);
        });

        // return media information
        const mediaData = {
          cloudinaryUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          originalName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          width: uploadResult.width,
          height: uploadResult.height
        };

        return res.status(200).json({
          success: true,
          message: 'Media uploaded successfully',
          media: mediaData
        });

      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload media' });
      }
    });

  } catch (error) {
    console.error('Media upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
