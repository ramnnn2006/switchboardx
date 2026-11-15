# switchhboard-mcp hosted API (plan / report_run / catalog_stats over HTTP).
# Needs a reachable HydraDB: pass HYDRA_HTTP_URL (+ HYDRA_TOKEN) at run time.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY data ./data
RUN npm run build && npm prune --omit=dev
ENV PORT=8787
EXPOSE 8787
CMD ["node", "dist/cli.js", "serve"]
