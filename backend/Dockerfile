# 1. Use Node image
FROM node:20-alpine

# 2. Create app directory
WORKDIR /SAR-GENERATOR/backend

# 3. Install dependencies
COPY package*.json ./
RUN npm install

# 4. Copy source code
COPY . .

# 5. Expose your port
EXPOSE 3001

# 6. Start the app
CMD ["npm", "start"]