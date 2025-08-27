# Use Node 18 LTS
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies first (cache)
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source and built dist (if present)
COPY tsconfig.node.json ./
COPY src ./src
COPY dist ./dist

# Build listener if sources are present (non-fatal)
RUN if [ -f package.json ] && [ -d src ]; then npm run build:listener || true; fi

ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/listener.js"]