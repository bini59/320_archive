# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

RUN addgroup --system --gid 1001 archive \
  && adduser --system --uid 1001 --ingroup archive archive \
  && mkdir /data \
  && chown archive:archive /data

COPY --from=build --chown=archive:archive /app/public ./public
COPY --from=build --chown=archive:archive /app/.next/standalone ./
COPY --from=build --chown=archive:archive /app/.next/static ./.next/static

USER archive
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]

