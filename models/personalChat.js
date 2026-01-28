import mongoose from "mongoose";

const personalChatSchema = new mongoose.Schema({
  participants: [{ type: String, required: true }], // Array of participant emails
  messages: [{
    sender: { type: String, required: true },
    message: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    messageType: { type: String, enum: ['text', 'file'], default: 'text' },
    timestamp: { type: Date, default: Date.now }
  }],
  lastMessage: { type: Date, default: Date.now }
});

// Create compound index for efficient queries
personalChatSchema.index({ participants: 1 });

const PersonalChat = mongoose.model("PersonalChat", personalChatSchema);

export default PersonalChat;