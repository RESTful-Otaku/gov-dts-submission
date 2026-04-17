FROM oven/bun:1.3.8-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE=
ARG VITE_AUTH_REQUIRED=false
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_AUTH_REQUIRED=$VITE_AUTH_REQUIRED

COPY package.json bun.lock ./
# Web image does not need Capacitor postinstall (iOS patches); scripts/ is not copied yet.
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN bun run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
