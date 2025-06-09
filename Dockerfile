FROM node:lts-alpine
USER root
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# (optional) give ownership of /app to the node user
RUN chown -R node:node /app
# Drop privileges again for runtime
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
