# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy application source code into the container
COPY . .

# Install dependencies for the minimal server
RUN npm init -y && npm install express socket.io

# Only expose one port for the server
EXPOSE 8083

# Define command to run the minimal server
CMD ["node", "minimal-server.js"]

