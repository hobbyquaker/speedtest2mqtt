FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY index.js config.js ./
COPY lib/ ./lib/

ENV NODE_ENV=production \
    SPEEDTEST2MQTT_MQTT_URL=mqtt://localhost \
    SPEEDTEST2MQTT_NAME=speedtest \
    SPEEDTEST2MQTT_VERBOSITY=info

# the default javascript backend needs nothing but outbound https, so the image ships no speedtest
# program; --backend cli would need one added to this image first
USER node

ENTRYPOINT ["node", "index.js"]
