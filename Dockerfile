# Stage 1: Build the frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
RUN npm install

COPY . .
RUN npm run build --prefix frontend

# Stage 2: Run the server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install --omit=dev

COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/backend/server.js ./backend/server.js
COPY --from=builder /app/backend/admin.html ./backend/admin.html

EXPOSE 5000
ENV API_BACKEND_PORT=5000
ENV API_BACKEND_HOST=0.0.0.0
ENV GOOGLE_CLOUD_PROJECT=gen-lang-client-0240369598
ENV GOOGLE_CLOUD_LOCATION=us-central1
ENV PROXY_HEADER=veGphcHWI3P9hme2kiNpNbfaGMoS_2yt

CMD ["node", "backend/server.js"]
