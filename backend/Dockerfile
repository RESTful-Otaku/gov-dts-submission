FROM golang:1.22-alpine AS builder

ARG API_BINARY=api

WORKDIR /app

# CGO required for sqlite3 driver; build-base and sqlite-dev for compilation
RUN apk add --no-cache ca-certificates build-base sqlite-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /bin/api ./cmd/${API_BINARY}

FROM alpine:3.20

# Runtime lib for sqlite when using DB_DRIVER=sqlite3
RUN apk add --no-cache ca-certificates sqlite-libs && addgroup -S app && adduser -S app -G app

USER app
WORKDIR /app

ENV APP_ENV=production
ENV HTTP_PORT=8080

COPY --from=builder /bin/api /app/api

EXPOSE 8080

ENTRYPOINT ["/app/api"]

