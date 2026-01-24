import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,

    mobile: {
      type: String,
      match: /^[0-9]{10}$/,
    },

    email: {
      type: String,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    address: {
      street: String,
      city: String,
      state: String,
      country: String,
    },

    loginId: {
      type: String,
      match: /^[A-Za-z0-9]{8}$/,
    },

    password: {
      type: String,
      match: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{6,}$/,
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
