const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");
const http = require("http");

const app = express();
console.log("Starting production-ready proxy server...");

// Add logging middleware for request debugging
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(`Headers: ${JSON.stringify(req.headers)}`);

  // Log when the response completes
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] Completed ${
        res.statusCode
      } in ${duration}ms`
    );
  });

  next();
});

// Create a dedicated proxy for Socket.IO
// Instead of proxying to localhost:3000, we directly integrate with the server.js socket server
const socketIOProxy = createProxyMiddleware({
  target: "http://localhost:3000",
  ws: true,
  secure: false, // Allow insecure connections for local development
  changeOrigin: true,
  logLevel: "debug",
  pathRewrite: {
    "^/socket.io": "/socket.io", // No path rewriting needed
  },
  onError: (err, req, res) => {
    console.error(`[Proxy Error] ${err.message}`);
    console.error(err.stack);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Proxy Error: ${err.message}`);
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(
      `[Proxy Request] ${req.method} ${req.url} -> http://localhost:3000${proxyReq.path}`
    );
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy Response] ${proxyRes.statusCode} for ${req.url}`);
  },
});

// Apply the Socket.IO proxy middleware
app.use("/socket.io", socketIOProxy);

// Serve static files with cache control headers for development
app.use(
  express.static(".", {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  })
);

// Create HTTP server
const server = http.createServer(app);

// Add error handling for the server
server.on("error", (err) => {
  console.error("HTTP Server Error:", err);
});

// Handle SPA routing - all non-asset paths go to index.html
app.get("*", (req, res) => {
  console.log(`[SPA Route] Serving index.html for ${req.url}`);
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start server on port 8083
server.listen(8083, "0.0.0.0", () => {
  console.log("Production-ready proxy server running on http://0.0.0.0:8083");
  console.log("Socket.IO traffic proxied to http://localhost:3000");

  // Log information about the server
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode`
  );
  console.log(`Server process ID: ${process.pid}`);
});
