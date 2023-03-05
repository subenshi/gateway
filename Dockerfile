FROM node:18.14-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json ./

RUN npm install --only=prod

# Bundle app source
COPY . .

EXPOSE 3000
CMD [ "npm", "start" ]