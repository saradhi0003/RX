FROM node:20-slim

# Install build tools for better-sqlite3 native module
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Persistent volume for SQLite DB
RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "dist/index.js"]
