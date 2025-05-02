import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendOtpEmail = async (email, otp) => {
  await transporter.sendMail({
    to: email,
    subject: 'Your OTP for account verification',
    html: `<p>Your OTP is: <b>${otp}</b></p>
           <p>This OTP is valid for 10 minutes only.</p>`
  });
};

