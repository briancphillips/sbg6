# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy server code and install backend dependencies
COPY js/server ./js/server/
RUN cd js/server && npm install --omit=dev

# Install global tools needed to run both servers
RUN npm install -g concurrently serve http-proxy-middleware

# Copy the rest of the application source code into the container
# (respecting .dockerignore)
COPY . .

# Create a proxy.js file to forward Socket.IO requests
RUN echo 'const { createProxyMiddleware } = require("http-proxy-middleware"); \
const express = require("express"); \
const app = express(); \
const path = require("path"); \
\
// Proxy all Socket.IO traffic to the Socket.IO server \
app.use("/socket.io", createProxyMiddleware({ \
  target: "http://localhost:3000", \
  ws: true, \
  changeOrigin: true, \
  logLevel: "debug" \
})); \
\
// Serve static files from current directory \
app.use(express.static(".")); \
\
// Fallback to index.html for SPA routing \
app.get("*", (req, res) => { \
  res.sendFile(path.join(__dirname, "index.html")); \
}); \
\
// Start Express server \
app.listen(8083, "0.0.0.0", () => { \
  console.log("Express server with proxy running on http://0.0.0.0:8083"); \
});' > proxy.js

# Make ports available to the world outside this container
# Port for the Socket.IO server
EXPOSE 3000
# Port for the frontend static server ('serve')
EXPOSE 8083

# Define command to run both the backend and frontend servers
# - Runs the node server for Socket.IO
# - Runs Express proxy server for the static files including Socket.IO forwarding
CMD concurrently "node js/server/server.js" "node proxy.js"

