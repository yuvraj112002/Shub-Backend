// routes/auth.js
import express from 'express';
import {login, logout, register, verifyOtp} from "../controllers/userController.js"
import { verifyUser } from '../miiddleware/auth.js';

const router = express.Router();

router.post('/register',register);

router.post('/login',login);

router.get("/logout",verifyUser,logout)

router.post('/verify-otp', verifyOtp);

// router.put('/profile/update',isAuthenticated ,upload.single("file"),updateProfile);

export default router;