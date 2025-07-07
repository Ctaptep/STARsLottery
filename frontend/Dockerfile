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

EXPOSE 5173

# Start the app
CMD ["pnpm", "run", "preview", "--", "--host"]
