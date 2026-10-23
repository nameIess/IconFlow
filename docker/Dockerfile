# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
RUN apk add --no-cache nginx

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY --chown=node:node api/resolve-icon.ts ./api/resolve-icon.ts
COPY --chown=node:node docker/resolver/server.mjs ./docker/resolver/server.mjs
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/security-headers.conf /etc/nginx/security-headers.conf

RUN mkdir -p /run/nginx /var/lib/nginx /var/log/nginx \
    && chown -R nginx:nginx /run/nginx /var/lib/nginx /var/log/nginx

EXPOSE 8080 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || \
  wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
