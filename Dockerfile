FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/public ./public
# Keys, the catalogue index and run state live in a volume so they survive a restart.
VOLUME /app/.data
EXPOSE 3210
CMD ["npm", "run", "start"]
