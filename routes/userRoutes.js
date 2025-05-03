// routes/auth.js
import express from 'express';
import {forgotPassword, login, logout, register, resendOtp, resetPassword, verifyOtp} from "../controllers/userController.js"
import { verifyUser } from '../miiddleware/auth.js';

const router = express.Router();

router.post('/register',register);

router.post('/login',login);

router.post('/verify-otp', verifyOtp);

router.post("/resend-otp", resendOtp);

router.get("/logout",verifyUser,logout);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);



export default router;