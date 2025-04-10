# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy server code and install backend dependencies
COPY js/server ./js/server/
RUN cd js/server && npm install --omit=dev

# Install global tools needed to run the servers
RUN npm install -g concurrently serve

# Copy the rest of the application source code into the container
# (respecting .dockerignore)
COPY . .

# Install proxy dependencies locally
RUN npm init -y && npm install express http-proxy-middleware

# Make ports available to the world outside this container
# Port for the Socket.IO server
EXPOSE 3000
# Port for the frontend static server ('serve')
EXPOSE 8083

# Define command to run both the backend and frontend servers
# - Runs the node server for Socket.IO
# - Runs Express proxy server for the static files including Socket.IO forwarding
CMD concurrently "node js/server/server.js" "node proxy.js"

