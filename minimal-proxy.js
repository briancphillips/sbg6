// Minimal proxy server to avoid path-to-regexp errors
const express = require("express");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");

const app = express();
console.log("Starting minimal proxy server...");

// Basic request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Socket.IO proxy with minimal options
const socketIOProxy = createProxyMiddleware({
  target: "http://localhost:3000",
  ws: true,
  changeOrigin: true,
});

// Mount the proxy
app.use("/socket.io", socketIOProxy);

// Static file server
app.use(express.static("."));

// Default route - No special patterns
app.use(function (req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Create server
const server = http.createServer(app);

// Start listening
server.listen(8083, "0.0.0.0", () => {
  console.log("Minimal proxy server running on http://0.0.0.0:8083");
  console.log("Socket.IO traffic proxied to http://localhost:3000");
});
