# Frontend Dockerfile for Telegram Lottery
FROM node:20

WORKDIR /app

# Install deps
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install --legacy-peer-deps --silent

# Copy source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
