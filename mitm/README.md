# Mitmproxy Helper Utilities for Copilot CLI

This directory contains helper utilities to capture HTTP traffic from GitHub Copilot CLI using mitmproxy. The captured
request logs in JSONL format can be later visualized by the web app in the outer directory.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) - Python package installer (used to run `mitmdump` via `uvx`)
- The utilities will automatically install mitmproxy when needed

## Quick Start

### 1. Start the Proxy and Capture to File

In one terminal, start the mitmproxy server and redirect output to a file:

**Windows:**
```cmd
cd ..\scripts
start-proxy.cmd > out.jsonl
```

**Linux/macOS:**
```bash
cd ../scripts
./start-proxy.sh > out.jsonl
```

This will:
- Start `mitmdump` on `127.0.0.1:8080`
- Load the `mitm-to-json.py` script to capture and format requests
- Save each HTTP request/response as a JSON line to `out.jsonl`

**Note:** To stop the proxy, press `Ctrl+C` twice in a row (the first time will prompt `Terminate batch job (Y/N)?`).

### 2. Run Copilot CLI Through the Proxy

In another terminal, use the proxied copilot wrapper:

**Windows:**
```cmd
cd ..\scripts
proxied-copilot.cmd
```

**Linux/macOS:**
```bash
cd ../scripts
./proxied-copilot.sh
```

This wrapper:
- Sets `http_proxy` and `https_proxy` to `http://127.0.0.1:8080`
- Sets `NODE_TLS_REJECT_UNAUTHORIZED=0` to bypass SSL verification
- Forwards all arguments to the `copilot` CLI

### 3. Output Format

Each line in `out.jsonl` will be a JSON object containing:
- `timestamp` - When the request started (ISO 8601 format)
- `completed` - When the response completed (ISO 8601 format)
- `url` - The full request URL
- `method` - HTTP method (GET, POST, etc.)
- `status_code` - HTTP response status code
- `request` - Object with `headers` and `body`
- `response` - Object with `headers` and `body`

## Files

- **`mitm-to-json.py`** - mitmproxy script that formats traffic as JSON lines
- **`../scripts/start-proxy.cmd`** / **`start-proxy.sh`** - Starts mitmproxy with the JSON logging script (Windows/Linux/macOS)
- **`../scripts/proxied-copilot.cmd`** / **`proxied-copilot.sh`** - Wrapper to run Copilot CLI through the proxy (Windows/Linux/macOS)

## Troubleshooting

- If you get SSL errors, ensure `NODE_TLS_REJECT_UNAUTHORIZED=0` is set
- The proxy runs on port 8080 by default - ensure this port is available
- If mitmproxy isn't found, ensure `uv` is installed and in your PATH
