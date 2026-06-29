FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 4001

CMD ["node", "index.js"]
