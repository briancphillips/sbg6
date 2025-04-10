const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");
const app = express();

console.log("Starting simple proxy server...");

// Proxy Socket.IO requests to port 3000
const socketIOProxy = createProxyMiddleware({
  target: "http://localhost:3000",
  ws: true, // Enable WebSocket proxying
  changeOrigin: true,
});

// Apply proxy to /socket.io path
app.use("/socket.io", socketIOProxy);

// Serve static files
app.use(express.static("."));

// Handle SPA routing - send all non-file requests to index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(8083, "0.0.0.0", () => {
  console.log("Simple proxy server running on http://0.0.0.0:8083");
});
