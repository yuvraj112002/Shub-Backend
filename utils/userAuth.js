// utils/authUtils.js
import jwt from "jsonwebtoken";

export const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });


export const cooldownOtp = (res, lastSent, limitInMs = 60000) => {
    const now = Date.now();
  
    if (lastSent && now - new Date(lastSent).getTime() < limitInMs) {
      const secondsLeft = Math.ceil((limitInMs - (now - new Date(lastSent).getTime())) / 1000);
      res.status(429).json({
        message: `Please wait ${secondsLeft}s before requesting another OTP.`,
      });
      return false;
    }
  
    return true;
  };