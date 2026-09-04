# Production image for one-time-note.
#
#   docker build -t one-time-note .
#   docker run -p 127.0.0.1:3000:3000 -v "$PWD/otn_data:/usr/src/app/notes" one-time-note
#
# The container speaks plain HTTP on one port and knows nothing about domains
# or TLS -- a reverse proxy in front terminates TLS and redirects.

# ---------------------------------------------------------------------------
# deps: resolve production dependencies in a stage that is thrown away, so no
# lockfile tooling, npm cache or dev dependency ends up in the shipped image.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

# --omit=dev replaces --only=production, which npm 9 removed.
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# runtime: application code plus production node_modules, nothing else.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

# Keeps Express from putting stack traces in error responses, and enables
# view caching. config/production.json inherits every value from default.json.
ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY --from=deps --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node app.js ./
COPY --chown=node:node config ./config
COPY --chown=node:node handlers ./handlers
COPY --chown=node:node routes ./routes
COPY --chown=node:node views ./views

# The notes directory is deliberately absent from the image: it is a mounted
# volume that has to outlive any single container, and app.js creates it on
# start if it is missing. That means the unprivileged user needs to be able to
# create a directory here, hence chowning the workdir itself (not -R, which
# would duplicate all of node_modules into another layer).
#
# A bind-mounted host directory keeps its own ownership, so it must be
# writable by uid 1000:  mkdir -p otn_data && chown 1000:1000 otn_data
RUN chown node:node /usr/src/app

USER node

# Must stay in agreement with APP_PORT in config/default.json.
EXPOSE 3000

# GET / renders the create-note page without touching storage, and is the
# health signal the deployment relies on. 127.0.0.1 is correct here because
# the check runs inside the container; the server itself binds 0.0.0.0.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --output-document=/dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", "app.js"]
