# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Install backend dependencies first to leverage Docker cache
COPY js/server/package.json js/server/package-lock.json ./js/server/
RUN cd js/server && npm ci --omit=dev

# Install global tools needed to run both servers
RUN npm install -g concurrently serve

# Copy the rest of the application source code into the container
# (respecting .dockerignore)
COPY . .

# Make ports available to the world outside this container
EXPOSE 3000 # For the Socket.IO server
EXPOSE 8080 # For the frontend static server ('serve')

# Define command to run both the backend and frontend servers
# - Runs the node server for Socket.IO
# - Runs 'serve' for the static files (HTML, CSS, client JS) from the root
#   '-s' flag rewrites requests to index.html for SPA-like behavior if needed
CMD ["concurrently", "node js/server/server.js", "serve -s . -l 8080"]
