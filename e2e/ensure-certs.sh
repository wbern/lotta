#!/bin/sh
# Generate self-signed TLS certs for P2P E2E tests if they don't exist.
CERT_DIR="$(dirname "$0")/certs"
CERT="$CERT_DIR/cert.pem"
KEY="$CERT_DIR/key.pem"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -newkey rsa:2048 -keyout "$KEY" -out "$CERT" \
    -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
  echo "[e2e] Generated self-signed TLS certs."
fi
