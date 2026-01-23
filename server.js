import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import User from "./models/user.js";

dotenv.config();

const app = express();

// Secure CORS configuration
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static("public"));

// Use environment variable for MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

app.post("/api/saveUser", async (req, res) => {
  try {
    // Field allowlist for security
    const allowedFields = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      mobile: req.body.mobile,
      email: req.body.email,
      address: req.body.address,
      loginId: req.body.loginId,
      password: req.body.password
    };
    const user = new User(allowedFields);
    await user.save();
    res.json({ success: true, message: "User saved successfully" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get("/api/getUsers", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
