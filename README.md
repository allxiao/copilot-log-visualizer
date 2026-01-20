# Copilot Log Visualizer

A web application built with NestJS to visualize Copilot CLI request/response logs from `.jsonl` files.

## Features

- 📁 Drag and drop `.jsonl` log files
- 📊 Chrome DevTools-like interface
- 📋 Request list sidebar with status codes and timing
- 📑 Tabbed view for request and response details
- 🔄 Automatic aggregation of chunked/streaming responses
- 🎨 Clean, modern UI

## Project Structure

```
copilot-log-visualizer/
├── src/
│   ├── main.ts           # Application entry point
│   ├── app.module.ts     # Main application module
│   ├── app.controller.ts # HTTP request controller
│   └── log.service.ts    # Log parsing logic
├── public/
│   ├── index.html        # Main HTML page
│   └── app.js            # Frontend JavaScript
├── package.json
└── tsconfig.json
```

## Prerequisites

- Node.js (v16 or higher)
- npm

## Installation

1. Install dependencies (if not already done):
```bash
npm install @nestjs/common@10 @nestjs/core@10 @nestjs/platform-express@10 reflect-metadata@0.1 rxjs@7 typescript@5 @types/node@20 @types/express@4
```

## Build and Run

1. Build the TypeScript code:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. Drag and drop your `.jsonl` log file onto the page, or click to browse
2. The app will parse and display all HTTP requests in the left sidebar
3. Click on any request to view its details
4. Switch between "Request" and "Response" tabs to see headers and body

## How It Works

### Backend (NestJS)

- **LogService**: Parses `.jsonl` files, aggregates chunked responses, and handles Server-Sent Events (SSE)
- **AppController**: Provides endpoints for serving the UI and parsing log files
- **JSON Parsing**: Automatically detects and parses JSON in request/response bodies

### Frontend

- **Drag & Drop**: File upload with drag-and-drop support
- **Request List**: Displays all parsed requests with method, status, URL, and timing
- **Detail View**: Shows complete request/response information including headers and body
- **Responsive**: Clean, modern interface inspired by Chrome DevTools

## API Endpoints

- `GET /` - Serves the main HTML page
- `POST /parse` - Accepts log content and returns parsed requests

## Log Format

The application expects `.jsonl` files where each line is a JSON object with this structure:

```json
{
  "timestamp": "ISO 8601 timestamp",
  "completed": "ISO 8601 timestamp (optional)",
  "url": "https://api.example.com/path",
  "method": "POST",
  "status_code": 200,
  "request": {
    "headers": {},
    "body": "string or JSON"
  },
  "response": {
    "headers": {},
    "body": "string, JSON, or SSE format"
  }
}
```

## Features in Detail

### Request Aggregation
- Groups multiple log entries for the same request (e.g., streaming responses)
- Merges response chunks intelligently
- Calculates request duration automatically

### SSE Support
- Detects Server-Sent Events format
- Parses `event:` and `data:` lines
- Displays structured SSE data

### JSON Formatting
- Automatically detects and parses JSON strings
- Pretty-prints JSON with proper indentation
- Syntax highlighting for better readability

## License

ISC
