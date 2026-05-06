FROM node:20-alpine AS builder
WORKDIR /app/frontend-react
COPY frontend-react/package*.json ./
RUN npm ci
COPY frontend-react/ ./
RUN npm run build
# vite outDir: '../frontend-build' → output lands at /app/frontend-build

FROM nginx:alpine
COPY --from=builder /app/frontend-build /usr/share/nginx/html/
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443 8443
