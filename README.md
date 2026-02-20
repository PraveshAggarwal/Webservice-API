# Webservice-API

 Mobzway Chat Application

A real-time personal chat application with user management, file sharing, and Socket.IO integration.

## Features
- User registration and authentication
- Real-time personal messaging
- File upload support (images, videos, audio, documents)
- Live user status
- Secure communication with HTTPS

## Deployment on Render

### Environment Variables Required
Set these in your Render dashboard under "Environment":

```
MONGODB_URI=your_mongodb_connection_string
PORT=3000
ALLOWED_ORIGINS=https://your-app.onrender.com
```

### Important Notes
1. **ALLOWED_ORIGINS**: Set this to your Render app URL (e.g., `https://webservice-api-8oy7.onrender.com`)
2. The `public/uploads/` directory is automatically created on server startup
3. Security headers (CSP, X-Frame-Options, etc.) are configured automatically

### Build Command
```bash
npm install
```

### Start Command
```bash
npm start
```

## Security Features
- Content Security Policy (CSP) headers
- CORS protection with environment-based origins
- XSS protection headers
- File upload validation
- Secure file storage

## Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values
3. Run `npm install`
4. Run `npm run dev` for development with nodemon
5. Access at `http://localhost:3000`

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose
- Socket.IO for real-time communication
- Multer for file uploads
- TailwindCSS for styling 
