import dotenv from "dotenv";
import connectDB from "./db/index.js";
import express from "express";
dotenv.config({path: "./.env"});



const app = express();

connectDB().then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
}).catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
});
