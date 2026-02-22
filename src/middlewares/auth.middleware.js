import AsyncHandler from "../utils/AsyncHandler.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
export const verifyJWT =AsyncHandler(async (req, res, next) => {
    try{
        // get access token from cookies
    // if access token is not present then throw error
    // if access token is present then verify it
    // if token is valid then attach user to the request object and call next middleware
    // if token is invalid then throw error

    const accessToken = req.cookies?.accessToken  || req.headers?.authorization?.split(" ")[1]; // support both cookie and header for access token
    if (!accessToken) {
        throw new ApiError("Access token is required", 401);
    }
    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id).select("-password -refreshToken"); // check if user exist or not
    if (!user) {
        throw new ApiError("User not found", 404);
    }
    req.user = user; // attach user to the request object
    next();
    }catch(error){
        if (error.name === "TokenExpiredError") {
            throw new ApiError("Access token expired", 401);
        } else if (error.name === "JsonWebTokenError") {
            throw new ApiError("Invalid access token", 401);
        } else {
            throw new ApiError("Failed to verify access token", 500);
        }
    }
})