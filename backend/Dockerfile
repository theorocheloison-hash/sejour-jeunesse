FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
ENV NODE_ENV=production
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh
CMD ["sh", "/app/start.sh"]
