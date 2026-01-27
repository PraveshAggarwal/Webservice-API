import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import User from "./models/user.js";
import ChatMessage from "./models/chat.js";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const LIVE_ROOM = "live_users";
const liveUsers = new Map(); // socketId -> { email, name, socketId }

// Secure CORS configuration
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  }),
);
app.use(bodyParser.json());

// Redirect root to welcome page
app.get("/", (req, res) => {
  res.redirect("/welcome.html");
});

app.use(express.static("public"));

// Use environment variable for MongoDB connection with timeout settings
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

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
    console.error('Save user error:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: errors 
      });
    } else if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      res.status(400).json({ 
        success: false, 
        error: `${field} already exists` 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Server error occurred' 
      });
    }
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }
    
    res.json({ 
      success: true, 
      user: { 
        email: user.email, 
        name: `${user.firstName} ${user.lastName}` 
      } 
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

app.get("/api/messages", async (req, res) => {
  try {
    const messages = await ChatMessage.find({})
      .sort({ timestamp: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.body;
    
    const message = await ChatMessage.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }
    
    if (message.userEmail !== userEmail) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    
    await ChatMessage.findByIdAndDelete(id);
    res.json({ success: true });
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

  socket.on("chat_message", async ({ user, email, message }) => {
    if (!user || !message || !email) return;

    try {
      const saved = await ChatMessage.create({
        user,
        message,
        userEmail: email,
      });

      io.emit("chat_message", saved);
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  });

  socket.on("delete_message", async ({ messageId, userEmail }) => {
    try {
      const message = await ChatMessage.findById(messageId);
      if (message && message.userEmail === userEmail) {
        await ChatMessage.findByIdAndDelete(messageId);
        io.emit("message_deleted", { messageId });
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
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
