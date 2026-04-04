#!/bin/sh
set -e
SERVER_NAME="${NGINX_SERVER_NAME:-clients.opensitesolutions.com}"

# HTTPS when fullchain + private key exist. acme.sh often writes key.pem; our docs use privkey.pem (nginx convention).
SSL_PRIVATE_KEY=""
if [ -f /etc/nginx/ssl/fullchain.pem ]; then
  if [ -f /etc/nginx/ssl/privkey.pem ]; then
    SSL_PRIVATE_KEY=privkey.pem
  elif [ -f /etc/nginx/ssl/key.pem ]; then
    SSL_PRIVATE_KEY=key.pem
  fi
fi

if [ -n "$SSL_PRIVATE_KEY" ]; then
  sed \
    -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
    -e "s|__SSL_PRIVATE_KEY__|${SSL_PRIVATE_KEY}|g" \
    /etc/nginx/templates/nginx-https.conf.template > /etc/nginx/conf.d/default.conf
else
  sed "s|__SERVER_NAME__|${SERVER_NAME}|g" /etc/nginx/templates/nginx-http.conf.template > /etc/nginx/conf.d/default.conf
fi
exec nginx -g 'daemon off;'
