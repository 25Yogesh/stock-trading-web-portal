# Use an official Node.js 16 Alpine image
FROM node:16-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Set environment variable for production
ENV NODE_ENV=production

# Expose the port your app runs on
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
