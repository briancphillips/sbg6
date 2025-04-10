# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy server code and install backend dependencies
COPY js/server ./js/server/
RUN cd js/server && npm install --omit=dev

# Copy the rest of the application source code into the container
# (respecting .dockerignore)
COPY . .

# Install dependencies for the combined server
RUN npm init -y && npm install express socket.io

# Only expose the combined server port
EXPOSE 8083

# Define command to run the combined server
CMD ["node", "combined-server.js"]

