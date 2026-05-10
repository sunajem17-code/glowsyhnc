FROM node:22-slim

# Install libatomic1 required by better-sqlite3
RUN apt-get update && apt-get install -y libatomic1 python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
