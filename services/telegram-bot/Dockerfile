FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Prune dev deps for smaller image
RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/index.js"]
