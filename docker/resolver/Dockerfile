# syntax=docker/dockerfile:1
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node api/resolve-icon.ts ./api/resolve-icon.ts
COPY --chown=node:node docker/resolver/server.mjs ./docker/resolver/server.mjs

USER node
EXPOSE 3000
CMD ["node", "docker/resolver/server.mjs"]
