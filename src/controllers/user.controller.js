import AsyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const genrateAccessAndRefreshToken = async (user) => {
    try {

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false }); // do because we are not updating any field which is required for validation and we want to save refresh token in database
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError("Failed to generate tokens", 500);
    }
}


const logoutUser = AsyncHandler(async (req, res) => {
    // get refresh token from cookies
    // validation check for refresh token
    // find user by refresh token
    // if user found then remove refresh token from database
    // clear cookies and send response to the frontend

   User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } }, { new: true }).exec();
   const cookieOptions = {
    httpOnly: true,
    secure: true, // Set to true if using HTTPS
    sameSite: "Strict", // Adjust based on your needs (e.g., "Lax" or "None")
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

    res.clearCookie("refreshToken", cookieOptions);
    res.clearCookie("accessToken", cookieOptions);
    return res.status(200).json(new ApiResponse(200, "Logout successful", null));
})

const loginUser = AsyncHandler(async (req, res) => {
    // get email/username and password from the frontend
    // validation check for email/username and password
    // check user exist or not by email/username
    // if user exist then compare password
    // if password is correct then generate access token and refresh token
    // save refresh token in database and send it using cookies
    // send response to the frontend with access token and user details except password and refresh token

    const { email, username, password } = req.body;
    if (!username && !email) {
        throw new ApiError("Email or username is required", 400);
    }
    const user = await User.findOne({ $or: [{ email }, { username }] });
    if (!user) {
        throw new ApiError("User not found with this email or username", 404);
    }
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError("Invalid credentials", 401);
    }

    const { accessToken, refreshToken } = await genrateAccessAndRefreshToken(user);
    // Save refresh token in database and send it using cookies
    const logedinUser = await User.findById(user._id).select("-password -refreshToken");
const cookieOptions = {
    httpOnly: true,
    secure: true, // Set to true if using HTTPS
    sameSite: "Strict", // Adjust based on your needs (e.g., "Lax" or "None")
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

    // Send response to the frontend with access token and user details except password and refresh token
    return res
        .status(200)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .cookie("accessToken", accessToken, cookieOptions)
        .json(new ApiResponse(200, "Login successful", { accessToken, refreshToken, user: logedinUser }));
});

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
    if ([username, fullName, email, password].some(field => field?.trim() === "")) {
        throw new ApiError("All fields are required", 400);
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        throw new ApiError("User already exist with this email or username", 400);
    }


    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath = "";

    if (req?.files && Array.isArray(req.files?.coverImage) && req.files?.coverImage.length > 0) {
        coverImageLocalPath = req.files?.coverImage[0]?.path;

    }

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


const refreshingAccessToken= AsyncHandler(async (req, res) => {
  try{
      // get refresh token from cookies
    // validation check for refresh token
    // find user by refresh token
    // if user found then generate new access token and refresh token
    // save new refresh token in database and send it using cookies
    // send response to the frontend with new access token

    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken; // support both cookie and body for refresh token
    if (!incomingRefreshToken) {
        throw new ApiError("Refresh token is required", 401);
    }

    const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    if (!decoded) {
        throw new ApiError("Invalid refresh token", 401);
    }
    const user = await User.findById(decoded._id);
    if (!user) {
        throw new ApiError("Invalid refresh token", 401);
    }

    if(incomingRefreshToken !== user.refreshToken) {
        throw new ApiError("Refresh token mismatch", 401);
    }
    const { accessToken, refreshToken: newRefreshToken } = await genrateAccessAndRefreshToken(user);
    const cookieOptions = {
        httpOnly: true,
        secure: true, // Set to true if using HTTPS
        sameSite: "Strict", // Adjust based on your needs (e.g., "Lax   or "None")
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    return res
        .cookie("refreshToken", newRefreshToken, cookieOptions)
        .cookie("accessToken", accessToken, cookieOptions)
        .status(200)
        .json(new ApiResponse(200, "Access token refreshed successfully", { accessToken }));
  }catch(error) {
    if (error.name === "TokenExpiredError") {
        throw new ApiError("Refresh token expired", 401);
    } else if (error.name === "JsonWebTokenError") {
        throw new ApiError("Invalid refresh token", 401);
    } else {
        throw new ApiError("Failed to refresh access token", 500);
    }
  }
})
export { registerUser, loginUser, logoutUser, refreshingAccessToken };