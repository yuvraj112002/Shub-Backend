import jwt from "jsonwebtoken";
import { User } from "../models/userSchema.js";
import { sendOtpEmail } from "../services/sendOtpService.js";
import bcrypt from "bcrypt"
// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

// Register
export const register = async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    if (!name || !email || !password || !phoneNumber) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const user = await User.create({
      name,
      email,
      password,
      phoneNumber,
      otp,
      otpExpires: Date.now() + 5 * 60 * 1000, // 5 min,
      deleteAt: new Date(Date.now() + 10 * 60 * 1000) // for TTL
    });

    const getingOtpResponse = await sendOtpEmail(email, otp);
    console.log(getingOtpResponse);

    res.cookie("verify_email", email, {
      httpOnly: true,
      secure: false, // true for HTTPS
      sameSite: "lax",
      maxAge: 5 * 60 * 1000, // 5 min
    });

    res.status(201).json({ message: "OTP sent to email. Please verify." });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Registration failed", error: err.message });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    const token = generateToken(user._id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login successful", userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// Logout
export const logout = (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    res.status(500).json({ message: "Logout failed", error: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  console.log(req.cookies)
  const email = req.cookies.verify_email;
  console.log(otp,email)
  if (!otp || !email) {
    return res.status(400).json({ message: "Email and otp is required or 5min are up" });
  }
  try {
    const user = await User.findOne({
      email,
      otpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.deleteAt = undefined;
    await user.save();

    // After OTP is verified
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    res.cookie("token", token, { httpOnly: true, maxAge: 86400000 });
    res.status(200).json({ message: "Email verified successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Verification failed", error: err.message });
  }
};
