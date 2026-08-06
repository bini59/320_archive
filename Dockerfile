# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS browser-base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libegl1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libwayland-client0 \
    libwayland-egl1 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM browser-base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS browser
RUN pnpm exec playwright install --with-deps chromium

FROM browser AS build
COPY . .
RUN pnpm build

FROM browser-base AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

RUN addgroup --system --gid 1001 archive \
  && adduser --system --uid 1001 --ingroup archive archive \
  && mkdir /data \
  && chown archive:archive /data

COPY --from=build --chown=archive:archive /ms-playwright /ms-playwright
COPY --from=build --chown=archive:archive /app/public ./public
COPY --from=build --chown=archive:archive /app/.next/standalone ./
COPY --from=build --chown=archive:archive /app/.next/static ./.next/static

USER archive
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
