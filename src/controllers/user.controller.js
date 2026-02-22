import AsyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
const registerUser = AsyncHandler(async (req, res) => {
    // get deatil from the frontned
    //validation check 
    // check user already exist or not by username or email
    // check for images & check for avatar
    //upload image to cloudinary
    // create user object create entery in database
    // remove password and refresh token from the user object before sending response
    // check for user creation 
    //return response to the frontend

    const { username, fullName, email, password } = req.body;
    console.log(username, fullName, email, password);
    if ([username, fullName, email, password].some(field => field?.trim() === "")) {
        throw new ApiError("All fields are required", 400);
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        throw new ApiError("User already exist with this email or username", 400);
    }


    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError("Avatar image is required", 400);
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!avatar) {
        throw new ApiError("Failed to upload avatar image", 500);
    }
    const user = await User.create({
        username: username.toLowerCase(),
        fullName,
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.secure_url || "",
    })


    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if (!createdUser) {
        throw new ApiError("Failed to create user", 500);
    }

    return res.status(201).json(new ApiResponse(200, "User registered successfully", createdUser));
})

export { registerUser }; 