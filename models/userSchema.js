import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phoneNumber: {
      type: Number,
      required: true,
    },
    isVerified: { type: Boolean, default: false },
    otp: {type:String},
    otpExpires: Date,
    deleteAt: { type: Date, expires: 600 } // document will auto-delete after 10 min
  },
  { timestamps: true }
);

// Encrypt password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);

  // 🔐 Hash OTP if modified
  if (this.isModified("otp") && this.otp) {
    this.otp = await bcrypt.hash(this.otp, 10);
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

export const User = mongoose.model("User", userSchema);
