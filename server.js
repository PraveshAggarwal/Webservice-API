import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import User from "./models/user.js";
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
      password: req.body.password,
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

io.on("connection", (socket) => {
  socket.on("join_live_users", ({ email, name }) => {
    if (!email || !name) return;

    const data = { email, name, socketId: socket.id };
    liveUsers.set(socket.id, data);

    socket.join(LIVE_ROOM);
    emitLiveUsers();
  });

  socket.on("watch_live_users", () => {
    socket.join(LIVE_ROOM);
    emitLiveUsers();
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
