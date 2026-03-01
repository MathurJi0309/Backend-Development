import AsyncHandler from '../utils/AsyncHandler.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import mongoose from 'mongoose';

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


const refreshingAccessToken = AsyncHandler(async (req, res) => {
    try {
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

        if (incomingRefreshToken !== user.refreshToken) {
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
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ApiError("Refresh token expired", 401);
        } else if (error.name === "JsonWebTokenError") {
            throw new ApiError("Invalid refresh token", 401);
        } else {
            throw new ApiError("Failed to refresh access token", 500);
        }
    }
})

const changeCurrentPassword = AsyncHandler(async (req, res) => {
    // get old password and new password from the frontend
    // validation check for old password and new password
    // find user by id from the request object
    // compare old password with the password in database
    // if old password is correct then update new password in database
    // send response to the frontend

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        throw new ApiError("Old password and new password are required", 400);
    }
    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError("User not found", 404);
    }
    const isOldPasswordValid = await user.isPasswordCorrect(oldPassword);
    if (!isOldPasswordValid) {
        throw new ApiError("Old password is incorrect", 401);
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: true });
    return res.status(200).json(new ApiResponse(200, "Password changed successfully", {}));
})


const getCurrentUserDetails = AsyncHandler(async (req, res) => {
    // find user by id from the request object
    // send response to the frontend with user details except password and refresh token


    return res.status(200).json(new ApiResponse(200, "User details fetched successfully", req.user));
})

const updateCurrentUserDetails = AsyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (!fullName || !email) {
        throw new ApiError("All fields are required", 400);
    }


    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            fullName,
            email,
        }
    }, { new: true }).select("-password -refreshToken");
    if (!user) {
        throw new ApiError("User not found", 404);
    }

    return res.status(200).json(new ApiResponse(200, "User details updated successfully", user));
})



const updateUserAvatar = AsyncHandler(async (req, res) => {
    const avatarLocalPath = req.files?.path;
    if (!avatarLocalPath) {
        throw new ApiError("Avatar image is required", 400);
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) {
        throw new ApiError("Failed to upload avatar image", 500);
    }
    const user = await User.findByIdAndUpdate(req.user._id, { avatar: avatar.url }, { new: true }).select("-password -refreshToken");
    if (!user) {
        throw new ApiError("User not found", 404);
    }
    return res.status(200).json(new ApiResponse(200, "User avatar updated successfully", user));
})


const updateUserCoverImage = AsyncHandler(async (req, res) => {
    const coverImageLocalPath = req.files?.path;
    if (!coverImageLocalPath) {
        throw new ApiError("Cover image is required", 400);
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.url) {
        throw new ApiError("Failed to upload cover image", 500);
    }
    const user = await User.findByIdAndUpdate(req.user._id, { coverImage: coverImage.url }, { new: true }).select("-password -refreshToken");
    if (!user) {
        throw new ApiError("User not found", 404);
    }
    return res.status(200).json(new ApiResponse(200, "User cover image updated successfully", user));
})


const getUserChannelProfile = AsyncHandler(async (req, res) => {
    // get user id from the request params
    // find user by id from the database
    // if user found then send response to the frontend with user details except password and refresh token
    // if user not found then send error response to the frontend

    const { username } = req.params;
    if (!username?.trim()) {
        throw new ApiError("Username is required", 400);
    }
    const channel = await User.aggregate([
        { $match: { username: username.toLowerCase() } },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        }, {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscriptions"
            }
        }, {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                subscriptionsCount: { $size: "$subscriptions" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        }, {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                subscriptionsCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
                createdAt: 1,

            }
        }]);
    if (!channel || channel.length === 0) {
        throw new ApiError("User not found", 404);
    }
    return res.status(200).json(new ApiResponse(200, "User channel profile fetched successfully", channel[0]));
})


const getWatchHistory = AsyncHandler(async (req, res) => {
    // get user id from the request object
    // find watch history by user id from the database
    const watchHistory = await User.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(req.user._id) } },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "uploader",
                            pipelines: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            uploader: { $first: "$uploader" }
                        }
                    }
                ]
            }
        }
    ]);
    // send response to the frontend with watch history details
   res.status(200).json(new ApiResponse(200, "Watch history fetched successfully", watchHistory[0]?.watchHistory || []));
})

export { registerUser, loginUser, logoutUser, refreshingAccessToken, changeCurrentPassword, getCurrentUserDetails, updateCurrentUserDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile,getWatchHistory };