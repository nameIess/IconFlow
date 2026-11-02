# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
# npm 12.2.1 bundles vulnerable undici 6.29.0. Replace only that package
# from its published tarball; running npm install in npm's own package root
# attempts to resolve npm's full dependency tree (including unavailable docs).
RUN npm install --global npm@12.2.1 --no-audit --no-fund \
    && npm pack undici@6.29.1 --pack-destination /tmp \
    && undici_dir="$(npm root -g)/npm/node_modules/undici" \
    && rm -rf "$undici_dir" \
    && mkdir -p "$undici_dir" \
    && tar -xzf /tmp/undici-6.29.1.tgz -C "$undici_dir" --strip-components=1 \
    && node -e "if (require('$undici_dir/package.json').version !== '6.29.1') process.exit(1)" \
    && rm /tmp/undici-6.29.1.tgz
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
# The runtime image contains npm too, so apply and verify the same undici patch.
RUN npm install --global npm@12.2.1 --no-audit --no-fund \
    && npm pack undici@6.29.1 --pack-destination /tmp \
    && undici_dir="$(npm root -g)/npm/node_modules/undici" \
    && rm -rf "$undici_dir" \
    && mkdir -p "$undici_dir" \
    && tar -xzf /tmp/undici-6.29.1.tgz -C "$undici_dir" --strip-components=1 \
    && node -e "if (require('$undici_dir/package.json').version !== '6.29.1') process.exit(1)" \
    && rm /tmp/undici-6.29.1.tgz \
    && apk add --no-cache nginx

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
