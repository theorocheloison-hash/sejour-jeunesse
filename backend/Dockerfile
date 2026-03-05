FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
