# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencies
WORKDIR /app

# Dependency files change less often than application source.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
