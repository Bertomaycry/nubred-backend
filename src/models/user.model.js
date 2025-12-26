import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    supabaseUserId: {
      type: String,
      unique: true,
      sparse: true, // Allows null values but enforces uniqueness when present
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    phoneNumber: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
    },
    accessToken: {
      type: String,
    },
    ban: {
      is_banned: { type: Boolean, default: false },
      type: {
        type: String,
        required: function () {
          return this.is_banned === true;
        },
      },
      reason: {
        type: String,
        required: function () {
          return this.is_banned === true;
        },
      },
      period: {
        type: Number,
        required: function () {
          return this.is_banned === true;
        },
      },
    },

    account_created: { type: Boolean, default: false },
    is_unregistered: { type: Boolean, default: false },
    unregister_requested: { type: Boolean, default: false },
    unregister_scheduled_at: { type: Date, default: null },
    is_account_created_skipped: { type: Boolean, default: false },
    is_onboarded: { type: Boolean, default: false },
    profile_type: {
      type: String,
      enum: ["company", "consultant"],
      default: null,
    },
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "profile_type",
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.ACCESS_TOKEN_SECRET_KEY,
    {
      expiresIn: "20m",
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SECRET_KEY, {
    expiresIn: "1d",
  });
};

const User = mongoose.model("User", userSchema);

export default User;
