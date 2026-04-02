#!/bin/sh
set -e
SERVER_NAME="${NGINX_SERVER_NAME:-clients.opensitesolutions.com}"
if [ -f /etc/nginx/ssl/fullchain.pem ] && [ -f /etc/nginx/ssl/privkey.pem ]; then
  sed "s|__SERVER_NAME__|${SERVER_NAME}|g" /etc/nginx/templates/nginx-https.conf.template > /etc/nginx/conf.d/default.conf
else
  sed "s|__SERVER_NAME__|${SERVER_NAME}|g" /etc/nginx/templates/nginx-http.conf.template > /etc/nginx/conf.d/default.conf
fi
exec nginx -g 'daemon off;'
