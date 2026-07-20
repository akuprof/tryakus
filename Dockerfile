FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./package.json
RUN npm install --omit=dev

COPY artifacts ./artifacts

EXPOSE 3000
CMD ["npm", "start"]
