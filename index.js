import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoute from "./routes/userRoutes.js"
dotenv.config();
const app = express();
app.use(cors());

// Database connection
await mongoose.connect(process.env.MONGO_URI,{
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Middleware
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
app.use(express.json());

// Routes
app.use("/api/v1/user",userRoute)


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));