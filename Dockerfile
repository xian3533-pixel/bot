FROM node:24-slim

RUN npm install -g pnpm

WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
