# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app

# Keep dependency installation cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

# Vite embeds this public value at build time. Never pass secrets here.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
ENV API_PROXY_TARGET=http://backend:3001 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="^(API_PROXY_TARGET|NGINX_LOCAL_RESOLVERS)$"

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker/19-validate-api-target.sh /docker-entrypoint.d/19-validate-api-target.sh
COPY --from=build /app/dist /usr/share/nginx/html

USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
