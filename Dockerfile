# One image that serves the dashboard, /graphql, and /healthz on port 8080.
#
# Multi-stage build: the first stages have compilers and dev tools; only the
# small final stage becomes the image that runs. Build it for Cloud Run with:
#   docker buildx build --platform linux/amd64 -t fan-insights .

# --- Stage 1: install every dependency (shared by both build stages) --------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Copy only the package files first. Docker caches each step, so as long as
# these files don't change, the slow `npm ci` is reused from cache even when
# the source code changes.
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci

# --- Stage 2: build the dashboard into static files (web/dist) --------------
FROM deps AS build-web
COPY web web
RUN npm run build -w web

# --- Stage 3: compile the API from TypeScript to JavaScript (api/dist) ------
FROM deps AS build-api
COPY api api
RUN npm run build -w api

# --- Stage 4: the runtime image. No TypeScript, Vite, or tests in here -----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
# Only the API's production dependencies; the dashboard is plain files now.
RUN npm ci --omit=dev --workspace api && npm cache clean --force
COPY --from=build-api /app/api/dist api/dist
COPY --from=build-web /app/web/dist web/dist
# Sample data, so the image works on its own (DATA_SOURCE=local, the default).
# On Cloud Run DATA_SOURCE=bigquery is set and these files are not used.
COPY data/sample data/sample
# Don't run as root: if the app were ever compromised, the attacker would
# only have the rights of this unprivileged user.
USER node
EXPOSE 8080
CMD ["node", "api/dist/index.js"]
