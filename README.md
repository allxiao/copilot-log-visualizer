# Copilot Log Visualizer

A web application built with NestJS to visualize GitHub Copilot CLI request/response logs from `.jsonl` files. Features a Chrome DevTools-like interface with intelligent parsing of OpenAI chat completion requests and responses.

## ✨ Features

### Core Functionality
- 📁 **Drag & Drop Interface** - Simply drop your `.jsonl` log file onto the page
- 📊 **Chrome DevTools-like UI** - Familiar interface with request list and detail panels
- 🔄 **Streaming Response Merging** - Automatically merges chunked/streaming responses
- 💾 **Large File Support** - Handles log files up to 50MB

### OpenAI Chat Completions Support
- 🤖 **Smart Request Parsing** - Structured display of messages, tools, and metadata
- 📝 **Message Summary** - Shows counts of user/system/assistant/tool messages at a glance
- 🔧 **Tool Call Navigation** - Click to navigate between tool calls and their results
- 💬 **Collapsible Messages** - Expand/collapse individual messages for better readability
- 🎯 **Token Usage Display** - Input/output token counts for each request
- 🧠 **Reasoning Field Support** - Displays reasoning_text, reasoning_opaque, and other special fields

### Filtering & Navigation
- 🔍 **Path Filtering** - Filter requests by API endpoint (multi-select dropdown)
- 💾 **Persistent Filters** - Your filter selections are remembered across sessions
- 🎨 **Request Highlighting** - Currently selected request is visually highlighted
- 🔗 **Interactive Tool IDs** - Click tool call IDs to jump between assistant messages and tool results

### Display Features
- 📑 **Tabbed Detail View** - Separate tabs for request and response details
- 🎴 **Collapsible Sections** - All cards can be expanded/collapsed for focused reading
- 🏷️ **Status Badges** - Color-coded HTTP status codes
- ⏱️ **Timing Information** - Request duration and timestamps
- 🎨 **Syntax Highlighting** - Pretty-printed JSON with proper formatting

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

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Clone or download this repository
2. Install dependencies:
```bash
npm install
```

### Build and Run

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
http://localhost:3001
```

## 📖 Usage

### Capturing Logs with Mitmproxy

To capture logs from GitHub Copilot CLI, use the mitmproxy helper utilities in the `scripts/` directory:

1. **Start the proxy** (in one terminal):

   **Windows:**
   ```cmd
   cd scripts
   start-proxy.cmd > out.jsonl
   ```

   **Linux/macOS:**
   ```bash
   cd scripts
   ./start-proxy.sh > out.jsonl
   ```

2. **Run Copilot CLI through the proxy** (in another terminal):

   **Windows:**
   ```cmd
   cd scripts
   proxied-copilot.cmd
   ```

   **Linux/macOS:**
   ```bash
   cd scripts
   ./proxied-copilot.sh
   ```

3. **Load the captured logs** into the visualizer by dragging `out.jsonl` onto the page

See [mitm/README.md](mitm/README.md) for detailed setup instructions.

### Basic Usage

1. **Upload Log File**: Drag and drop your `.jsonl` log file onto the page, or click to browse
2. **Browse Requests**: All HTTP requests appear in the left sidebar with method, status, and timing
3. **View Details**: Click on any request to view its full details
4. **Switch Tabs**: Use "Request" and "Response" tabs to see headers and body

### Filtering Requests

1. **Open Filter**: Click the "Filter" dropdown at the top of the request list
2. **Select Paths**: Check/uncheck API paths to show only relevant requests
3. **Persistent Selection**: Your filter choices are saved and restored on reload
4. **Auto-Reset**: Filters automatically clear when loading a file with different paths

### Navigating Tool Calls

For OpenAI chat completion requests with tool calls:

1. **From Tool Call to Result**: Click the tool call ID in an assistant message to jump to the corresponding tool message
2. **From Result to Tool Call**: Click the tool_call_id in a tool message to jump back to the specific tool call
3. **Auto-Expand**: Messages are automatically expanded when navigating
4. **Highlight**: Target element is temporarily highlighted for easy identification

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

## 🔧 Technical Details

### Request Aggregation

Multiple log entries for the same request (identified by timestamp and URL) are automatically merged:
- Streaming response chunks are combined intelligently
- Duration is calculated from first to last chunk
- All response data is preserved

### OpenAI Streaming Response Merging

For `/chat/completions` requests with streaming responses:
- **Delta Merging**: Combines partial `content` strings across chunks
- **Tool Calls**: Merges tool call deltas by index, building complete function calls
- **Field Preservation**: All fields (including reasoning_text, reasoning_opaque, refusal, etc.) are preserved
- **Usage Statistics**: Token counts from the final chunk are included
- **Structured View**: Merged response is rendered with expandable Choices and Metadata cards

### Request List Display

The request list shows context-specific information:

**For `/chat/completions` requests:**
- HTTP method (left) | Message/tool summary (center) | Status code (right)
- URL path on second line
- Timing and token usage on third line
- Message counts: `U2/S1/A3/R2/T5` = 2 user, 1 system, 3 assistant, 2 tool messages, 5 tools
- Token usage: `1234/567` = input tokens / output tokens

**For other requests:**
- HTTP method (left) | Status code (right)
- URL path on second line
- Timing on third line

### Message Display

Request messages are rendered with special handling:

- **Content**: Main message content (text or JSON)
- **Refusal**: Displayed with red styling if present
- **Reasoning Fields**: Any reasoning-related fields shown with blue styling
- **Tool Calls**: Rendered as structured cards with function name, arguments, and clickable IDs
- **Tool Messages**: Show tool_call_id in header for navigation back to the original call

### Filter Persistence

Filter selections are stored in browser localStorage:
- Selections survive page reloads
- Maintained when loading new files (if paths match)
- Automatically reset only when no selected paths exist in new data
- Stored as JSON array of path strings

## 🎨 UI Features

### Collapsible Sections

All content sections can be collapsed/expanded:
- **Request View**: General, Messages, Tools, Metadata sections
- **Response View**: Choices, Metadata, Merged Body, Raw Body sections
- **Messages**: Individual message cards can be collapsed
- **Smart Defaults**: Most-used sections expanded by default

### Visual Indicators

- **Status Badges**: Green for 2xx, red for errors
- **Method Badges**: Color-coded HTTP methods
- **Token Counts**: Tooltips explain abbreviations
- **Hover Effects**: Subtle highlighting on interactive elements
- **Selection Highlight**: Active request shown with blue background

## 🏗️ Architecture

### Backend (NestJS)

- **main.ts**: Application bootstrap, configures Express with 50MB body limit
- **app.module.ts**: Main application module
- **app.controller.ts**: HTTP endpoints (GET / and POST /parse)
- **log.service.ts**: Core log parsing and SSE handling logic

### Frontend (Vanilla JS)

- **index.html**: UI structure and all CSS styles
- **app.js**: All frontend logic including:
  - File upload handling
  - Request list rendering and filtering
  - Request/response detail rendering
  - OpenAI-specific parsing and merging
  - Navigation and interaction handlers
  - LocalStorage persistence

### API Endpoints

- `GET /` - Serves the main HTML page
- `POST /parse` - Accepts `{ content: string }` and returns `ParsedRequest[]`

## 📝 Log Format

The application expects `.jsonl` files where each line is a JSON object:

```json
{
  "timestamp": "2024-01-20T08:00:00.000Z",
  "completed": "2024-01-20T08:00:01.234Z",
  "url": "https://api.openai.com/v1/chat/completions",
  "method": "POST",
  "status_code": 200,
  "request": {
    "headers": { "Content-Type": "application/json" },
    "body": { "messages": [...], "tools": [...] }
  },
  "response": {
    "headers": { "Content-Type": "text/event-stream" },
    "body": "data: {...}\n\ndata: {...}\n\n" // or JSON object
  }
}
```

### Response Body Formats

The tool handles multiple response body formats:

1. **JSON Object**: Standard JSON response
2. **SSE Format**: Server-Sent Events with `data:` lines
3. **Array**: Pre-parsed SSE chunks as array of objects
4. **Chunked Array**: Multiple response bodies merged into array

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development

1. Make your changes to the TypeScript/HTML/CSS files
2. Build: `npm run build`
3. Test: `npm start` and open http://localhost:3001
4. Verify all existing features still work

## 📄 License

ISC

## 🙏 Acknowledgments

Built for visualizing GitHub Copilot CLI logs with a focus on OpenAI chat completion requests.
