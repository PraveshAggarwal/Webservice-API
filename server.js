import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import User from "./models/user.js";
import PersonalChat from "./models/personalChat.js";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory");
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|mp3|wav/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

const app = express();
const server = http.createServer(app);

// Get allowed origins from environment or use defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [
      "http://localhost:3000",
      "https://webservice-api-8oy7.onrender.com",
      "https://webservice-api-2.onrender.com",
    ];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

const LIVE_ROOM = "live_users";
const liveUsers = new Map(); // socketId -> { email, name, socketId }

// Relaxed Security Headers - preventing Chrome "Dangerous Site" warning
app.use((req, res, next) => {
  // More permissive Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "script-src * 'unsafe-inline' 'unsafe-eval'; " +
      "style-src * 'unsafe-inline'; " +
      "img-src * data: blob:; " +
      "font-src * data:; " +
      "connect-src *; " +
      "media-src *; " +
      "object-src *; " +
      "frame-src *;",
  );

  // Basic security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  next();
});

// Secure CORS configuration
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(bodyParser.json());

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Redirect root to welcome page
app.get("/", (req, res) => {
  res.redirect("/welcome.html");
});

app.use(express.static("public"));

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
      password: req.body.password,
    };

    const user = new User(allowedFields);
    await user.save();
    res.json({ success: true, message: "User saved successfully" });
  } catch (err) {
    console.error("Save user error:", err);

    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      });
    } else if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      res.status(400).json({
        success: false,
        error: `${field} already exists`,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Server error occurred",
      });
    }
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/getUsers", async (req, res) => {
  try {
    const filter = {};
    if (req.query.email) {
      filter.email = req.query.email;
    }
    const users = await User.find(filter);
    res.json(users);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/users-list/:currentUser", async (req, res) => {
  try {
    const { currentUser } = req.params;
    const users = await User.find({ email: { $ne: currentUser } }).select(
      "firstName lastName email",
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Personal chat endpoints
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    // Simulate slow upload to show loading (500ms-1s based on file size)
    const fileSize = req.file.size;
    const delay = Math.min(1000, Math.max(500, fileSize / 500000)); // 0.5-1 seconds
    await new Promise((resolve) => setTimeout(resolve, delay));

    res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/chat/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const participants = [user1, user2].sort();
    const chat = await PersonalChat.findOne({ participants });
    res.json(chat || { participants, messages: [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

io.on("connection", (socket) => {
  socket.on("join_chat", ({ email, name }) => {
    if (!email || !name) return;

    const data = { email, name, socketId: socket.id };
    liveUsers.set(socket.id, data);
    socket.join(LIVE_ROOM);
    emitLiveUsers();
  });

  socket.on("join_personal_chat", ({ user1, user2 }) => {
    const room = [user1, user2].sort().join("-");
    socket.join(room);
  });

  socket.on(
    "send_message",
    async ({ sender, recipient, message, fileData }) => {
      if (!sender || !recipient || (!message && !fileData)) return;

      try {
        const participants = [sender, recipient].sort();
        let chat = await PersonalChat.findOne({ participants });

        if (!chat) {
          chat = new PersonalChat({ participants, messages: [] });
        }

        const newMessage = {
          sender,
          timestamp: new Date(),
          messageType: fileData ? "file" : "text",
        };

        if (fileData) {
          newMessage.fileUrl = fileData.url;
          newMessage.fileName = fileData.originalName;
          newMessage.fileSize = fileData.size;
          newMessage.message = fileData.originalName;
        } else {
          newMessage.message = message;
        }

        chat.messages.push(newMessage);
        chat.lastMessage = new Date();
        const savedChat = await chat.save();

        // Get the saved message with _id
        const savedMessage = savedChat.messages[savedChat.messages.length - 1];

        const room = participants.join("-");
        io.to(room).emit("receive_message", savedMessage);
      } catch (err) {
        console.error("Failed to save message:", err);
      }
    },
  );

  socket.on("delete_message", async ({ messageId, userEmail }) => {
    try {
      const chat = await PersonalChat.findOne({
        "messages._id": messageId,
        "messages.sender": userEmail,
      });

      if (chat) {
        chat.messages.pull(messageId);
        await chat.save();

        const room = chat.participants.sort().join("-");
        io.to(room).emit("message_deleted", { messageId });
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  });

  socket.on("logout", () => {
    if (liveUsers.has(socket.id)) {
      liveUsers.delete(socket.id);
      emitLiveUsers();
    }
  });

  socket.on("disconnect", () => {
    if (liveUsers.has(socket.id)) {
      liveUsers.delete(socket.id);
      emitLiveUsers();
    }
  });
});

function emitLiveUsers() {
  const users = Array.from(liveUsers.values());
  io.to(LIVE_ROOM).emit("live_users_update", users);
}

const PORT = process.env.PORT || 3000;

// Connect to MongoDB first, then start server
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      bufferCommands: false, // Disable buffering to fail fast instead of timing out
    });
    console.log("MongoDB connected successfully");

    // Start server only after DB connection is established
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1); // Exit if can't connect to DB
  }
};

startServer();

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});
