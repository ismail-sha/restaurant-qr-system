FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Run migrations then start
CMD ["sh", "-c", "node src/config/migrate.js && node src/config/seed.js && node src/index.js"]

EXPOSE 5000
