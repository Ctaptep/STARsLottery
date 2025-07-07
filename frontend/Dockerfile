# Frontend Dockerfile for Telegram Lottery
FROM node:20

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install deps using pnpm
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build the app
RUN pnpm run build

EXPOSE 5173

# Start the app
CMD ["pnpm", "run", "preview", "--", "--host"]
