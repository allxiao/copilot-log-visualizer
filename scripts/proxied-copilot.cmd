@echo off
setlocal

set HTTP_PROXY=http://127.0.0.1:8080
set HTTPS_PROXY=http://127.0.0.1:8080
set NODE_USE_ENV_PROXY=1
set NODE_TLS_REJECT_UNAUTHORIZED=0

call copilot %*
