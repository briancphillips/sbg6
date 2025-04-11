# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy application source code into the container
# Copy package.json and package-lock.json first for better caching
COPY js/server/package.json js/server/package-lock.json ./js/server/

# Install dependencies specifically for the main server
WORKDIR /app/js/server
RUN npm install

# Go back to the app root and copy the rest of the code
WORKDIR /app
COPY . .

# Expose the correct port for the combined server
EXPOSE 8083

# Define command to run the combined server
CMD ["node", "js/server/server.js"]

