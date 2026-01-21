# Mitmproxy Helper Utilities for Copilot CLI

This directory contains helper utilities to capture HTTP traffic from GitHub Copilot CLI using mitmproxy. The captured
request logs in JSONL format can be later visualized by the web app in the outer directory.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) - Python package installer (used to run `mitmdump` via `uvx`)
- The utilities will automatically install mitmproxy when needed

You need to whitelist the mitmproxy's CA cert, so that the certificate is trusted when you intercept HTTPS traffic.

1. Run `uvx --from mitmproxy mitmweb`
2. This will open a web page at `http://127.0.0.1:8081`, if not, manually open it.
3. Configure your browser to use the mitmproxy's proxy: `http://127.0.0.1:8080`, and click the "File" --> "Install Certificates..."

   This will open `http://mitm.it/`. If the proxy is configured properly, you will see the instructions of importing the
   certificates.

   You can also do this manually. Go to `%USERPROFILE%\.mitmproxy\`, then import the certificate `mitmproxy-ca-cert.p12`
   to the `Trusted Root Certificate Authority` of your machine, starting by right click and "Install PFX".

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
cd path\to\your\project
path\to\scripts\proxied-copilot.cmd
```

**Linux/macOS:**
```bash
cd path/to/your/project
path/to/scripts/proxied-copilot.sh
```

> [!NOTE]
> You can copy the wrapper script to one of your `PATH` directory, so that it can be invoked directly from your working
project directory.

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
