#!/bin/sh
set -eu

# The target is substituted into Nginx configuration, and must be an origin.
# Paths (including a trailing slash) would replace the rewritten request URI.
if [ "$(printf '%s' "${API_PROXY_TARGET:-}" | tr -d '\r\n')" != "${API_PROXY_TARGET:-}" ] ||
   ! printf '%s\n' "${API_PROXY_TARGET:-}" | grep -Eq '^https?://([a-zA-Z0-9][a-zA-Z0-9.-]*|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?$'; then
    echo >&2 'API_PROXY_TARGET must be an HTTP(S) origin, e.g. http://backend:3001, without a path, trailing slash, credentials, or query.'
    exit 1
fi
