import { User } from "../models/userSchema.js";
import { sendOtpEmail } from "../services/sendOtpService.js";
import bcrypt from "bcrypt";
import { cooldownOtp, generateOtp, generateToken } from "../utils/userAuth.js";


export const register = async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    if (!name || !email || !password || !phoneNumber) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });

    // ✅ CASE 1: If user exists and is verified
    if (existingUser && existingUser.isVerified) {
      return res.status(409).json({ message: "Email already registered" });
    }
    const otp = generateOtp();

    res.cookie("verify_email", email, {
      httpOnly: true,
      secure: false, // true for HTTPS
      sameSite: "lax",
      maxAge: 10 * 60 * 1000, // 10 min
    });
    
    // ✅ CASE 2: If user exists but NOT verified → update and resend OTP
    if (existingUser && !existingUser.isVerified) {
      existingUser.name = name;
      existingUser.password = password;
      existingUser.phoneNumber = phoneNumber;
      existingUser.otp = otp;
      existingUser.otpExpires = Date.now() + 5 * 60 * 1000;
      existingUser.lastOtpSent = Date.now();
      existingUser.deleteAt = new Date(Date.now() + 10 * 60 * 1000);
      await existingUser.save();

      await sendOtpEmail(email, otp);
      return res
        .status(200)
        .json({ message: "OTP re-sent. Please verify your email." });
    }

    // Case 3 : if it was new user
    const user = await User.create({
      name,
      email,
      password,
      phoneNumber,
      otp, //Otp is stored in encrypted format
      otpExpires: new Date(Date.now() + 5 * 60 * 1000), // 5 min,
      lastOtpSent: new Date(), // if user didn't verify them in 10min than we are deleting their data
      deleteAt : new Date(Date.now() + 10 * 60 * 1000)
    });

    await sendOtpEmail(email, otp);

    res.status(201).json({ message: "OTP sent to email. Please verify." });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Registration failed", error: err.message });
  }
};

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

export const logout = (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    res.status(500).json({ message: "Logout failed", error: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  let { otp } = req.body;

  const email = req.cookies?.verify_email;
  if (!otp || !email) {
    return res
      .status(400)
      .json({ message: "Email and otp is required or 10 to verify it" });
  }

  otp = typeof otp === "string" ? otp.trim() : String(otp).trim();

  try {
    const user = await User.findOne({
      email,
      otpExpires: { $gt: new Date() }
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
    user.lastOtpSent = undefined
    await user.save();

    res.clearCookie("verify_email");
    // After OTP is verified
    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true for HTTPS
      sameSite: "lax",
    });
    res.status(200).json({ message: "Email verified successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Verification failed", error: err.message });
  }
};

export const resendOtp = async (req, res,next) => {
  try {
    const email = req.cookies?.verify_email;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required registerd again" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User already verified" });
    }

    // Check if TTL already removed user
    if (user?.deleteAt && user?.deleteAt < new Date()) {
      return res
        .status(410)
        .json({ message: "Account expired. Please register again." });
    }

    // Check if cooldown (60 sec) has passed
    if (!cooldownOtp(res, user.lastOtpSent)) return; 

    // Generate new OTP
    const otp = generateOtp()

    user.otp = otp;
    user.otpExpires = new Date(now + 5 * 60 * 1000); // 5 minutes
    user.lastOtpSent = new Date();
    await user.save();

    await sendOtpEmail(email, otp);

    res.status(200).json({ message: "OTP resent successfully" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to resend OTP", error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found with that email." });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your account first." });
    }

    // Cooldown (same as resend logic)
    if (!cooldownOtp(res, user.lastOtpSent)) return; 

    // Generate OTP
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    await user.save();

    await sendOtpEmail(email, otp);

    res.status(200).json({
      message: "OTP sent to your email. Please verify to reset password.",
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Something went wrong", error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email, OTP, and new password are required." });
    }

    const user = await User.findOne({
      email,
      otpExpires: { $gt: new Date() },
    });
    console.log(user);
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }
    console.log(otp,user.otp)
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.lastOtpSent = undefined
    await user.save();

    res
      .status(200)
      .json({ message: "Password reset successful. You can now login." });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to reset password", error: err.message });
  }
};
