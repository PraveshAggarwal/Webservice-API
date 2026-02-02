import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      validate: {
        validator: function (v) {
          return /^[A-Za-z\s]+$/.test(v);
        },
        message: "First name should only contain letters and spaces",
      },
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      validate: {
        validator: function (v) {
          return /^[A-Za-z\s]+$/.test(v);
        },
        message: "Last name should only contain letters and spaces",
      },
      trim: true,
    },

    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      validate: {
        validator: function (v) {
          return /^[0-9]{10}$/.test(v);
        },
        message: "Mobile number must be exactly 10 digits",
      },
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
      lowercase: true,
      trim: true,
    },

    address: {
      street: {
        type: String,
        required: [true, "Street address is required"],
        validate: {
          validator: function (v) {
            return /^[A-Za-z0-9\s,.-]+$/.test(v);
          },
          message: "Street address contains invalid characters",
        },
        trim: true,
      },
      city: {
        type: String,
        required: [true, "City is required"],
        validate: {
          validator: function (v) {
            return /^[A-Za-z\s]+$/.test(v);
          },
          message: "City should only contain letters and spaces",
        },
        trim: true,
      },
      state: {
        type: String,
        required: [true, "State is required"],
        validate: {
          validator: function (v) {
            return /^[A-Za-z\s]+$/.test(v);
          },
          message: "State should only contain letters and spaces",
        },
        trim: true,
      },
      country: {
        type: String,
        required: [true, "Country is required"],
        validate: {
          validator: function (v) {
            return /^[A-Za-z\s]+$/.test(v);
          },
          message: "Country should only contain letters and spaces",
        },
        trim: true,
      },
    },

    loginId: {
      type: String,
      required: [true, "Login ID is required"],
      unique: true,
      validate: {
        validator: function (v) {
          return /^[A-Za-z0-9]{8}$/.test(v);
        },
        message: "Login ID must be exactly 8 alphanumeric characters",
      },
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      validate: {
        validator: function (v) {
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{6,}$/.test(v);
        },
        message:
          "Password must be at least 6 characters with uppercase, lowercase, and special character",
      },
    },
  },
  { timestamps: true },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
