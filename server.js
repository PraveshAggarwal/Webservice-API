import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import http from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import User from "./models/user.js";
import PersonalChat from "./models/personalChat.js";
import { generateToken, authMiddleware } from "./utils/jwt.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// =========================
// ✅ Ensure uploads folder
// =========================

const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// =========================
// ✅ SECURITY MIDDLEWARE
// =========================

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// ✅ CORS
// =========================

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "https://webservice-api-2.onrender.com"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// =========================
// ✅ STATIC FILES
// =========================

app.use(express.static("public"));

// =========================
// ✅ SAFE ROOT + HEALTH
// =========================

app.get("/", (req, res) => {
  res.status(200).send("API server is running safely");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// =========================
// ✅ MULTER UPLOAD
// =========================

const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.random();
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// =========================
// ✅ USER ROUTES
// =========================

app.post("/api/saveUser", async (req, res) => {
  try {
    const allowed = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      mobile: req.body.mobile,
      email: req.body.email,
      address: req.body.address,
      loginId: req.body.loginId,
      password: req.body.password,
    };

    const user = new User(allowed);
    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: "User save failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false });
    }

    const token = generateToken({
      id: user._id,
      email: user.email,
      name: user.firstName + " " + user.lastName,
    });

    res.json({
      success: true,
      token,
      user: {
        email: user.email,
        name: user.firstName + " " + user.lastName,
      },
    });
  } catch {
    res.status(500).json({ success: false });
  }
});

app.get("/api/getUsers", authMiddleware, async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/users-list/:currentUser", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({
      email: { $ne: req.params.currentUser },
    }).select("firstName lastName email");

    res.json(users);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// =========================
// ✅ FILE UPLOAD
// =========================

app.post("/api/upload", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file" });
  }

  res.json({
    success: true,
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    size: req.file.size,
  });
});

// =========================
// ✅ CHAT API
// =========================

app.get("/api/chat/:user1/:user2", authMiddleware, async (req, res) => {
  try {
    const participants = [req.params.user1, req.params.user2].sort();
    const chat = await PersonalChat.findOne({ participants });

    res.json(chat || { participants, messages: [] });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// =========================
// ✅ SOCKET.IO
// =========================

const io = new Server(server, {
  cors: { origin: allowedOrigins },
});

io.on("connection", (socket) => {
  socket.on("join_personal_chat", ({ user1, user2 }) => {
    const room = [user1, user2].sort().join("-");
    socket.join(room);
  });

  socket.on("send_message", async (data) => {
    try {
      const { sender, recipient, message } = data;
      const participants = [sender, recipient].sort();

      let chat = await PersonalChat.findOne({ participants });

      if (!chat) {
        chat = new PersonalChat({ participants, messages: [] });
      }

      chat.messages.push({
        sender,
        message,
        timestamp: new Date(),
      });

      await chat.save();

      const room = participants.join("-");
      io.to(room).emit("receive_message", chat.messages.at(-1));
    } catch (err) {
      console.error("Socket save error:", err);
    }
  });
});

// =========================
// ✅ START SERVER AFTER DB
// =========================

const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(PORT, () => console.log("Server running on", PORT));
  })
  .catch((err) => {
    console.error("MongoDB failed:", err);
    process.exit(1);
  });

// =========================
// ✅ SHUTDOWN HANDLER
// =========================

process.on("SIGTERM", () => {
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
});
