import { Router } from "express";
import { changeCurrentPassword,
    getCurrentUserDetails, 
    getUserChannelProfile, 
    getWatchHistory, 
    loginUser, 
    logoutUser, 
    registerUser, 
    updateCurrentUserDetails, 
    updateUserAvatar, 
    updateUserCoverImage } from "../controllers/user.controller.js";

import {upload} from "../middlewares/multer.middleware.js";
import {verifyJWT } from "../middlewares/auth.middleware.js";
import { refreshingAccessToken } from "../controllers/user.controller.js";
const router = Router();

router.route("/register").post(upload.fields([{ name: "avatar", maxCount: 1 }, { name: "coverImage", maxCount: 1 }]), registerUser);
router.route("/login").post(loginUser);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshingAccessToken);
router.route("/watch-history").get(verifyJWT, getWatchHistory);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUserDetails);
router.route("/update-account").patch(verifyJWT, updateCurrentUserDetails);
router.route("/update-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/update-cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);
router.route("/channel/:username").get(verifyJWT, getUserChannelProfile);
router.route("/watch-history").get(verifyJWT, getWatchHistory);


export default router;