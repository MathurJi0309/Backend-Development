import dotenv from "dotenv";
import connectDB from "./db/index.js";
import {app} from "./app.js";
dotenv.config({path: "./.env"});
const PORT = process.env.PORT || 5000;




connectDB().then(() => {
    app.on('error', (err) => {
        console.error("Server error:", err);
    });
    app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
}).catch((err) => {
    console.error("Failed to connect to the database:", err);
});