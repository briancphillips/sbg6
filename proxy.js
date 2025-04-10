const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");
const app = express();
const path = require("path");

console.log("Starting Socket.IO proxy server...");

// Proxy all Socket.IO traffic to the Socket.IO server
app.use(
  "/socket.io",
  createProxyMiddleware({
    target: "http://localhost:3000",
    ws: true,
    changeOrigin: true,
    logLevel: "debug",
  })
);

// Serve static files from current directory
app.use(express.static("."));

// Fallback to index.html for SPA routing - use a simple string path
// The previous version might have had a malformed path pattern
app.get("*", function (req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Add error handling
app.on("error", (err) => {
  console.error("Express server error:", err);
});

// Start Express server
const server = app.listen(8083, "0.0.0.0", () => {
  console.log("Express server with proxy running on http://0.0.0.0:8083");
});

// Keep the process alive
process.on("SIGINT", () => {
  console.log("Shutting down proxy server...");
  server.close(() => {
    console.log("Proxy server closed");
    process.exit(0);
  });
});

// Log uncaught exceptions to prevent silent crashes
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
