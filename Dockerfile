# syntax = docker/dockerfile:1.4.2-labs

FROM node:14.19-slim as sc2-gamedata

RUN <<EOF
    set -eux
    apt-get update && apt-get install -y git
EOF

RUN git clone --depth 1 https://github.com/SC2Mapster/SC2GameData.git /sc2-gamedata


FROM node:14.19-slim

RUN <<EOF
    set -eux
    apt-get update && apt-get install -y \
        git \
        python \
        make \
        build-essential \
        libx11-xcb1 \
        libxtst6 \
        libxss1
    rm -rf /var/lib/apt/lists/*
EOF

# We don't need the standalone Chromium
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
RUN apt-get update && apt-get install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get update && \
  apt-get install google-chrome-stable -y --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

RUN <<EOF
    mkdir /app
    chown node:node /app
EOF

ENV YARN_CACHE_FOLDER=/tmp/.yarn_cache

WORKDIR /app

COPY package.json yarn.lock ./

RUN --mount=type=cache,target=/tmp/.yarn_cache <<EOF
    set -eux
    yarn install --pure-lockfile --no-interactive
EOF

COPY . .

RUN <<EOF
    set -eux
    yarn run build
EOF

COPY --from=sc2-gamedata --chown=node:node /sc2-gamedata /app/sc2-gamedata

USER node:node

CMD ["node", "lib/src/start.js"]
