#!/bin/bash

export HTTP_PROXY=http://127.0.0.1:8080
export HTTPS_PROXY=http://127.0.0.1:8080
export NODE_USE_ENV_PROXY=1
export NODE_TLS_REJECT_UNAUTHORIZED=0

copilot "$@"
