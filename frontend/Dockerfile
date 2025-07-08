# Frontend Dockerfile for Telegram Lottery
FROM node:20

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json ./

# Install deps using pnpm (without frozen-lockfile to generate it if missing)
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

# Copy source
COPY . .

# Build the app
RUN pnpm run build

EXPOSE 8080

# Start the app
CMD ["sh", "-c", "pnpm run preview -- --host 0.0.0.0 --port ${PORT:-8080}"]
