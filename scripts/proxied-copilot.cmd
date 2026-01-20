@echo off
setlocal

set http_proxy=http://127.0.0.1:8080
set https_proxy=http://127.0.0.1:8080
set NODE_TLS_REJECT_UNAUTHORIZED=0

copilot %*
