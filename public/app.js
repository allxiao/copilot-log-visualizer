let requests = [];
let selectedRequest = null;
let selectedPaths = new Set(); // Track selected filter paths

// Load saved filter selections from localStorage
function loadFilterSelections() {
  try {
    const saved = localStorage.getItem('copilot-log-filter-paths');
    if (saved) {
      selectedPaths = new Set(JSON.parse(saved));
    }
  } catch (error) {
    console.error('Error loading filter selections:', error);
  }
}

// Save filter selections to localStorage
function saveFilterSelections() {
  try {
    localStorage.setItem('copilot-log-filter-paths', JSON.stringify([...selectedPaths]));
  } catch (error) {
    console.error('Error saving filter selections:', error);
  }
}

// Initialize filter selections on load
loadFilterSelections();

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const container = document.getElementById('container');
const sidebar = document.getElementById('sidebar');
const requestPanel = document.getElementById('request-panel');
const responsePanel = document.getElementById('response-panel');
const headerUpload = document.getElementById('headerUpload');
const headerDropZone = document.getElementById('headerDropZone');
const headerFileInput = document.getElementById('headerFileInput');

dropZone.addEventListener('click', () => fileInput.click());

// Header upload - click to browse
headerDropZone.addEventListener('click', () => headerFileInput.click());

// Header upload - drag and drop
headerDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  headerDropZone.classList.add('dragover');
});

headerDropZone.addEventListener('dragleave', () => {
  headerDropZone.classList.remove('dragover');
});

headerDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  headerDropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFile(file);
  }
});

headerFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFile(file);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
});

async function handleFile(file) {
  if (!file.name.endsWith('.jsonl')) {
    alert('Please select a .jsonl file');
    return;
  }

  const content = await file.text();
  
  // Check if we're already viewing logs (to determine if we should push or replace state)
  const isAlreadyViewingLogs = container.classList.contains('visible');
  
  sidebar.innerHTML = '<div class="loading">Parsing logs...</div>';
  dropZone.classList.add('hidden');
  container.classList.add('visible');
  headerUpload.classList.add('visible');

  try {
    const response = await fetch('/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    requests = await response.json();
    renderRequestList();
    
    // If already viewing logs, replace state; otherwise push new state
    if (isAlreadyViewingLogs) {
      history.replaceState({ view: 'logs', requests: requests }, '', '#logs');
    } else {
      history.pushState({ view: 'logs', requests: requests }, '', '#logs');
    }
  } catch (error) {
    sidebar.innerHTML = '<div class="empty-state">Error parsing logs</div>';
    console.error('Error:', error);
  }
}

function renderRequestList() {
  if (requests.length === 0) {
    sidebar.innerHTML = '<div class="empty-state">No requests found</div>';
    return;
  }

  // Extract unique paths
  const uniquePaths = [...new Set(requests.map(req => {
    try {
      return new URL(req.url).pathname;
    } catch {
      return req.url;
    }
  }))].sort();

  // Check if any of the selected paths exist in the current data
  const selectedPathsArray = [...selectedPaths];
  const hasMatchingPaths = selectedPathsArray.some(path => uniquePaths.includes(path));
  
  // Reset to "all" if none of the selected paths match
  if (selectedPaths.size > 0 && !hasMatchingPaths) {
    selectedPaths.clear();
    saveFilterSelections();
  }

  // Filter requests based on selected paths
  const filteredRequests = selectedPaths.size === 0 
    ? requests 
    : requests.filter(req => {
        try {
          return selectedPaths.has(new URL(req.url).pathname);
        } catch {
          return selectedPaths.has(req.url);
        }
      });

  // Render filter header
  const filterHtml = `
    <div class="filter-header">
      <label>Filter:</label>
      <div class="filter-dropdown">
        <button class="filter-button" onclick="toggleFilterDropdown(event)">
          ${selectedPaths.size === 0 ? 'All paths' : `${selectedPaths.size} selected`}
          <span class="dropdown-arrow">▼</span>
        </button>
        <div class="filter-options" id="filterOptions" style="display: none;">
          <div class="filter-option">
            <label>
              <input type="checkbox" ${selectedPaths.size === 0 ? 'checked' : ''} onchange="selectAllPaths()">
              <strong>All paths</strong>
            </label>
          </div>
          ${uniquePaths.map(path => `
            <div class="filter-option">
              <label>
                <input type="checkbox" value="${path}" ${selectedPaths.has(path) ? 'checked' : ''} onchange="togglePath('${path.replace(/'/g, "\\'")}')">
                ${path}
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  sidebar.innerHTML = filterHtml;

  // Render filtered request items
  filteredRequests.forEach((req, index) => {
    const actualIndex = requests.indexOf(req);
    const item = document.createElement('div');
    item.className = 'request-item';
    
    // Check if this is an LLM call (OpenAI or Anthropic)
    const isChatCompletions = isOpenAIChatCompletions(req);
    const isAnthropic = isAnthropicMessages(req);

    if (isChatCompletions || isAnthropic) {
      const summary = isChatCompletions ? getChatCompletionsSummary(req) : getAnthropicMessagesSummary(req);
      item.innerHTML = `
        <div class="request-title">
          <span class="method ${req.method}">${req.method}</span>
          <span class="chat-summary" title="${summary.messageTooltip}">${summary.messageSummary}</span>
          <span class="status-badge ${req.status >= 200 && req.status < 300 ? 'success' : 'error'}">${req.status}</span>
        </div>
        <div class="url">${new URL(req.url).pathname}</div>
        <div class="meta">${new Date(req.timestamp).toLocaleTimeString()} • ${req.duration}ms • <span class="token-summary" title="${summary.tokenTooltip}">${summary.tokenSummary}</span></div>
      `;
    } else {
      item.innerHTML = `
        <div class="request-title">
          <span class="method ${req.method}">${req.method}</span>
          <span class="status-badge ${req.status >= 200 && req.status < 300 ? 'success' : 'error'}">${req.status}</span>
        </div>
        <div class="url">${new URL(req.url).pathname}</div>
        <div class="meta">${new Date(req.timestamp).toLocaleTimeString()} • ${req.duration}ms</div>
      `;
    }
    
    item.addEventListener('click', () => selectRequest(actualIndex));
    sidebar.appendChild(item);
  });
}

function getChatCompletionsSummary(req) {
  const body = req.request.body;
  
  // Count messages by role
  const messages = body.messages || [];
  const userCount = messages.filter(m => m.role === 'user').length;
  const systemCount = messages.filter(m => m.role === 'system').length;
  const assistantCount = messages.filter(m => m.role === 'assistant').length;
  const toolCount = messages.filter(m => m.role === 'tool').length;
  const toolsCount = (body.tools || []).length;
  
  // Get token usage from response
  let inputTokens = '?';
  let outputTokens = '?';
  
  if (req.response.body) {
    // Try to get merged response
    const isChunked = Array.isArray(req.response.body);
    if (isChunked) {
      const merged = mergeOpenAIStreamingResponse(req.response.body);
      if (merged && merged.usage) {
        inputTokens = merged.usage.prompt_tokens || '?';
        outputTokens = merged.usage.completion_tokens || '?';
      }
    } else if (req.response.body.usage) {
      inputTokens = req.response.body.usage.prompt_tokens || '?';
      outputTokens = req.response.body.usage.completion_tokens || '?';
    }
  }
  
  const messageSummary = `U${userCount} / S${systemCount} / A${assistantCount} / R${toolCount} / T${toolsCount}`;
  const messageTooltip = `User: ${userCount}, System: ${systemCount}, Assistant: ${assistantCount}, Tool Results: ${toolCount}, Tools: ${toolsCount}`;
  
  const tokenSummary = `${inputTokens} / ${outputTokens}`;
  const tokenTooltip = `Input tokens: ${inputTokens}, Output tokens: ${outputTokens}`;
  
  return { messageSummary, messageTooltip, tokenSummary, tokenTooltip };
}

function getAnthropicMessagesSummary(req) {
  const body = req.request.body;

  // Count messages by role
  const messages = body.messages || [];
  const userCount = messages.filter(m => m.role === 'user').length;
  const assistantCount = messages.filter(m => m.role === 'assistant').length;

  // Count system items from body.system[]
  const systemCount = Array.isArray(body.system) ? body.system.length : 0;

  // Count tool_use blocks in assistant messages, tool_result blocks in user messages
  let toolUseCount = 0;
  let toolResultCount = 0;
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use') toolUseCount++;
        if (block.type === 'tool_result') toolResultCount++;
      }
    }
  }

  // Count tools
  const toolsCount = (body.tools || []).length;

  // Get token usage from response
  let inputTokens = '?';
  let outputTokens = '?';

  if (req.response.body) {
    const isChunked = Array.isArray(req.response.body);
    if (isChunked) {
      const merged = mergeAnthropicStreamingResponse(req.response.body);
      if (merged && merged.usage) {
        inputTokens = merged.usage.input_tokens || '?';
        outputTokens = merged.usage.output_tokens || '?';
      }
    } else if (req.response.body.usage) {
      inputTokens = req.response.body.usage.input_tokens || '?';
      outputTokens = req.response.body.usage.output_tokens || '?';
    }
  }

  const messageSummary = `U${userCount} / S${systemCount} / A${assistantCount} / R${toolResultCount} / T${toolsCount}`;
  const messageTooltip = `User: ${userCount}, System: ${systemCount}, Assistant: ${assistantCount}, Tool Results: ${toolResultCount}, Tools: ${toolsCount}`;

  const tokenSummary = `${inputTokens} / ${outputTokens}`;
  const tokenTooltip = `Input tokens: ${inputTokens}, Output tokens: ${outputTokens}`;

  return { messageSummary, messageTooltip, tokenSummary, tokenTooltip };
}

function selectRequest(index) {
  selectedRequest = requests[index];
  
  // Remove selected class from all items
  document.querySelectorAll('.request-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Add selected class to the clicked item
  // Find the item that corresponds to this request
  const items = document.querySelectorAll('.request-item');
  const filteredRequests = selectedPaths.size === 0 
    ? requests 
    : requests.filter(req => {
        try {
          return selectedPaths.has(new URL(req.url).pathname);
        } catch {
          return selectedPaths.has(req.url);
        }
      });
  
  const filteredIndex = filteredRequests.indexOf(requests[index]);
  if (filteredIndex !== -1 && items[filteredIndex]) {
    items[filteredIndex].classList.add('selected');
  }

  renderRequestDetails();
  renderResponseDetails();
}

function renderRequestDetails() {
  if (!selectedRequest) return;

  const isOpenAI = isOpenAIChatCompletions(selectedRequest);

  requestPanel.innerHTML = `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>General</span>
      </div>
      <div class="section-body" style="display: none;">
        <div class="info-row">
          <div class="info-label">Request URL</div>
          <div class="info-value">${selectedRequest.url}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Request Method</div>
          <div class="info-value">${selectedRequest.method}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Status Code</div>
          <div class="info-value">
            <span class="status-badge ${selectedRequest.status >= 200 && selectedRequest.status < 300 ? 'success' : 'error'}">
              ${selectedRequest.status}
            </span>
          </div>
        </div>
        <div class="info-row">
          <div class="info-label">Timestamp</div>
          <div class="info-value">${new Date(selectedRequest.timestamp).toLocaleString()}</div>
        </div>
        ${selectedRequest.completed ? `
        <div class="info-row">
          <div class="info-label">Completed</div>
          <div class="info-value">${new Date(selectedRequest.completed).toLocaleString()}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Duration</div>
          <div class="info-value">${selectedRequest.duration}ms</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Request Headers</span>
      </div>
      <div class="section-body" style="display: none;">
        ${Object.entries(selectedRequest.request.headers).map(([key, value]) => `
          <div class="info-row">
            <div class="info-label">${key}</div>
            <div class="info-value">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${selectedRequest.request.body ? renderRequestBody(selectedRequest) : ''}
  `;
}

function isOpenAIChatCompletions(request) {
  return request.url.includes('/chat/completions') &&
         request.request.body &&
         typeof request.request.body === 'object';
}

function isAnthropicMessages(request) {
  return request.url.includes('/v1/messages') &&
         request.request.body &&
         typeof request.request.body === 'object';
}

function isLLMCall(request) {
  return isOpenAIChatCompletions(request) || isAnthropicMessages(request);
}

function renderRequestBody(request) {
  const body = request.request.body;
  
  if (!isOpenAIChatCompletions(request) && !isAnthropicMessages(request)) {
    return `
    <div class="section">
      <div class="section-header">Request Body</div>
      <div class="section-body">
        <pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>
      </div>
    </div>
    `;
  }

  if (isAnthropicMessages(request)) {
    return renderAnthropicRequestBody(request);
  }

  // OpenAI Chat Completions specific rendering
  const messages = body.messages || [];
  const tools = body.tools || [];
  const metadata = {};
  
  // Extract metadata (everything except messages and tools)
  for (const [key, value] of Object.entries(body)) {
    if (key !== 'messages' && key !== 'tools') {
      metadata[key] = value;
    }
  }

  return `
    ${messages.length > 0 ? `
    <div class="section collapsible">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▼</span>
        <span>Messages</span>
      </div>
      <div class="section-body">
        ${messages.map((msg, idx) => `
          <div class="message-item collapsible${msg.role === 'system' ? ' collapsed' : ''}" id="message-${idx}">
            <div class="message-role collapsible-header" onclick="toggleSection(this)">
              <div>
                <span class="toggle-icon">${msg.role === 'system' ? '▶' : '▼'}</span>
                <strong>${msg.role || 'unknown'}</strong>
              </div>
              ${msg.role === 'tool' && msg.tool_call_id ? `<span class="tool-id tool-id-link" onclick="navigateToToolCall('${msg.tool_call_id}', event)">${msg.tool_call_id}</span>` : ''}
            </div>
            <div class="message-body"${msg.role === 'system' ? ' style="display: none;"' : ''}>
              ${msg.content ? `<div class="message-content">${escapeHtml(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2))}</div>` : ''}
              ${msg.refusal ? `
                <div style="margin-top: 8px;">
                  <div style="font-weight: 600; color: #d73a49; font-size: 12px; margin-bottom: 4px;">Refusal</div>
                  <div class="message-content" style="border-left: 3px solid #d73a49; padding-left: 12px; background: #ffeef0;">${escapeHtml(msg.refusal)}</div>
                </div>
              ` : ''}
              ${Object.entries(msg)
                .filter(([key]) => !['role', 'content', 'refusal', 'tool_calls', 'name', 'tool_call_id', 'parsed'].includes(key))
                .map(([key, value]) => `
                  <div style="margin-top: 8px;">
                    <div style="font-weight: 600; color: #0366d6; font-size: 12px; margin-bottom: 4px;">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                    <div class="message-content" style="border-left: 3px solid #0366d6; padding-left: 12px; background: #f1f8ff;">${typeof value === 'string' ? escapeHtml(value) : `<pre style="margin: 0; background: transparent; border: none; padding: 0;">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`}</div>
                  </div>
                `).join('')}
              ${msg.tool_calls ? `
                <div class="message-tools">
                  <strong>Tool Calls:</strong>
                  <div style="margin-top: 8px;">
                    ${msg.tool_calls.map(tc => `
                      <div class="tool-item" id="tool-call-${tc.id}">
                        <div class="tool-header">
                          <div>
                            <strong>${tc.type || 'function'}: ${tc.function?.name || 'Unknown'}</strong>
                            ${tc.index !== undefined ? `<span class="badge" style="margin-left: 8px;">Index: ${tc.index}</span>` : ''}
                          </div>
                          ${tc.id ? `<span class="tool-id tool-id-link" onclick="navigateToToolResult('${tc.id}', event)">${tc.id}</span>` : ''}
                        </div>
                        ${tc.function?.arguments ? `
                          <div class="tool-args">
                            <strong>Arguments:</strong>
                            <pre>${escapeHtml(typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments, null, 2))}</pre>
                          </div>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              ${msg.name ? `<div class="message-name"><strong>Name:</strong> ${msg.name}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${tools.length > 0 ? `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Tools</span>
      </div>
      <div class="section-body" style="display: none;">
        ${tools.map((tool, idx) => `
          <div class="tool-item collapsible collapsed">
            <div class="tool-header collapsible-header" onclick="toggleSection(this)">
              <span class="toggle-icon">▶</span>
              <strong>${tool.type || 'function'}${tool.function?.name ? `: ${tool.function.name}` : ''}</strong>
            </div>
            <div class="tool-body" style="display: none;">
              ${tool.function?.description ? `<div class="tool-description" style="white-space: pre-wrap;">${escapeHtml(tool.function.description)}</div>` : ''}
              ${tool.function?.parameters ? `<div class="tool-params"><pre>${escapeHtml(JSON.stringify(tool.function.parameters, null, 2))}</pre></div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${Object.keys(metadata).length > 0 ? `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Metadata</span>
      </div>
      <div class="section-body" style="display: none;">
        ${Object.entries(metadata).map(([key, value]) => `
          <div class="info-row">
            <div class="info-label">${key}</div>
            <div class="info-value">${typeof value === 'object' ? `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>` : escapeHtml(String(value))}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Request Body (Raw)</span>
      </div>
      <div class="section-body" style="display: none;">
        <pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>
      </div>
    </div>
  `;
}

function renderAnthropicRequestBody(request) {
  const body = request.request.body;
  const systemItems = body.system || [];
  const messages = body.messages || [];
  const tools = body.tools || [];
  const metadata = {};

  // Extract metadata (everything except messages, system, and tools)
  for (const [key, value] of Object.entries(body)) {
    if (key !== 'messages' && key !== 'system' && key !== 'tools') {
      metadata[key] = value;
    }
  }

  return `
    ${systemItems.length > 0 ? `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>System</span>
      </div>
      <div class="section-body" style="display: none;">
        ${systemItems.map((item, idx) => `
          <div class="message-item" id="system-${idx}">
            <div class="message-role">
              <strong>${item.type || 'text'}</strong>
              ${item.cache_control ? `<span class="badge">${item.cache_control.type || 'cached'}</span>` : ''}
            </div>
            <div class="message-body">
              <div class="message-content">${escapeHtml(item.text || JSON.stringify(item, null, 2))}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${messages.length > 0 ? `
    <div class="section collapsible">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▼</span>
        <span>Messages</span>
      </div>
      <div class="section-body">
        ${messages.map((msg, idx) => `
          <div class="message-item collapsible" id="message-${idx}">
            <div class="message-role collapsible-header" onclick="toggleSection(this)">
              <div>
                <span class="toggle-icon">▼</span>
                <strong>${msg.role || 'unknown'}</strong>
              </div>
            </div>
            <div class="message-body">
              ${renderAnthropicMessageContent(msg.content)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${tools.length > 0 ? `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Tools</span>
      </div>
      <div class="section-body" style="display: none;">
        ${tools.map((tool, idx) => `
          <div class="tool-item collapsible collapsed">
            <div class="tool-header collapsible-header" onclick="toggleSection(this)">
              <span class="toggle-icon">▶</span>
              <strong>${tool.name || 'Unknown'}</strong>
              ${tool.type ? `<span class="badge" style="margin-left: 8px;">${tool.type}</span>` : ''}
            </div>
            <div class="tool-body" style="display: none;">
              ${tool.description ? `<div class="tool-description" style="white-space: pre-wrap;">${escapeHtml(tool.description)}</div>` : ''}
              ${tool.input_schema ? `<div class="tool-params"><pre>${escapeHtml(JSON.stringify(tool.input_schema, null, 2))}</pre></div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${Object.keys(metadata).length > 0 ? `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Metadata</span>
      </div>
      <div class="section-body" style="display: none;">
        ${Object.entries(metadata).map(([key, value]) => `
          <div class="info-row">
            <div class="info-label">${key}</div>
            <div class="info-value">${typeof value === 'object' ? `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>` : escapeHtml(String(value))}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Request Body (Raw)</span>
      </div>
      <div class="section-body" style="display: none;">
        <pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>
      </div>
    </div>
  `;
}

function renderAnthropicMessageContent(content) {
  if (typeof content === 'string') {
    return `<div class="message-content">${escapeHtml(content)}</div>`;
  }

  if (!Array.isArray(content)) {
    return `<pre>${escapeHtml(JSON.stringify(content, null, 2))}</pre>`;
  }

  return content.map((block, idx) => {
    switch (block.type) {
      case 'text':
        return `<div class="message-content">${escapeHtml(block.text || '')}</div>`;

      case 'tool_use':
        return `
          <div class="tool-item" id="tool-call-${block.id}">
            <div class="tool-header">
              <div>
                <strong>tool_use: ${block.name || 'Unknown'}</strong>
              </div>
              ${block.id ? `<span class="tool-id tool-id-link" onclick="navigateToToolResult('${block.id}', event)">${block.id}</span>` : ''}
            </div>
            ${block.input ? `
              <div class="tool-args">
                <strong>Input:</strong>
                <pre>${escapeHtml(typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2))}</pre>
              </div>
            ` : ''}
          </div>
        `;

      case 'tool_result':
        return `
          <div class="tool-item" id="tool-result-${block.tool_use_id}">
            <div class="tool-header">
              <div>
                <strong>tool_result</strong>
                ${block.is_error ? `<span class="badge" style="background: #d73a49; color: white; margin-left: 8px;">Error</span>` : ''}
              </div>
              ${block.tool_use_id ? `<span class="tool-id tool-id-link" onclick="navigateToToolCall('${block.tool_use_id}', event)">${block.tool_use_id}</span>` : ''}
            </div>
            <div class="tool-args">
              ${typeof block.content === 'string'
                ? `<div class="message-content">${escapeHtml(block.content)}</div>`
                : Array.isArray(block.content)
                  ? block.content.map(c => c.type === 'text' ? `<div class="message-content">${escapeHtml(c.text || '')}</div>` : `<pre>${escapeHtml(JSON.stringify(c, null, 2))}</pre>`).join('')
                  : `<pre>${escapeHtml(JSON.stringify(block.content, null, 2))}</pre>`
              }
            </div>
          </div>
        `;

      default:
        return `<pre>${escapeHtml(JSON.stringify(block, null, 2))}</pre>`;
    }
  }).join('');
}

function toggleSection(header) {
  const section = header.parentElement;
  const body = section.querySelector('.section-body, .message-body, .tool-body');
  const icon = header.querySelector('.toggle-icon');

  if (section.classList.contains('collapsed')) {
    section.classList.remove('collapsed');
    if (body) body.style.display = 'block';
    icon.textContent = '▼';
  } else {
    section.classList.add('collapsed');
    if (body) body.style.display = 'none';
    icon.textContent = '▶';
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function renderResponseDetails() {
  if (!selectedRequest) return;

  const isOpenAI = isOpenAIChatCompletions(selectedRequest);
  const isAnthropic = isAnthropicMessages(selectedRequest);
  const isChunked = Array.isArray(selectedRequest.response.body);
  const isRichFormat = isOpenAI || isAnthropic;

  // Try to merge if it's an LLM call OR if it's any chunked response with SSE format
  let mergedResponse = null;
  if (isChunked && selectedRequest.response.body.length > 0) {
    if (isOpenAI) {
      mergedResponse = mergeOpenAIStreamingResponse(selectedRequest.response.body);
    } else if (isAnthropic) {
      mergedResponse = mergeAnthropicStreamingResponse(selectedRequest.response.body);
    } else {
      // For non-LLM chunked responses, try to extract and merge 'data' fields
      mergedResponse = mergeGenericStreamingResponse(selectedRequest.response.body);
    }
  }

  // Check if non-chunked response already has the complete response structure
  const hasCompleteResponse = !isChunked && isOpenAI &&
    selectedRequest.response.body &&
    typeof selectedRequest.response.body === 'object' &&
    selectedRequest.response.body.choices;

  // Check if non-chunked Anthropic response has complete structure
  const hasCompleteAnthropicResponse = !isChunked && isAnthropic &&
    selectedRequest.response.body &&
    typeof selectedRequest.response.body === 'object' &&
    selectedRequest.response.body.content;

  responsePanel.innerHTML = `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Response Headers</span>
      </div>
      <div class="section-body" style="display: none;">
        ${Object.entries(selectedRequest.response.headers).map(([key, value]) => `
          <div class="info-row">
            <div class="info-label">${key}</div>
            <div class="info-value">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${mergedResponse && isOpenAI ? renderOpenAIResponseBody(mergedResponse) : ''}
    ${hasCompleteResponse ? renderOpenAIResponseBody(selectedRequest.response.body) : ''}
    ${mergedResponse && isAnthropic ? renderAnthropicResponseBody(mergedResponse) : ''}
    ${hasCompleteAnthropicResponse ? renderAnthropicResponseBody(selectedRequest.response.body) : ''}

    ${mergedResponse ? `
    <div class="section collapsible ${isRichFormat ? 'collapsed' : ''}">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">${isRichFormat ? '▶' : '▼'}</span>
        <span>Response Body (Merged)</span>
      </div>
      <div class="section-body" ${isRichFormat ? 'style="display: none;"' : ''}>
        <pre>${escapeHtml(JSON.stringify(mergedResponse, null, 2))}</pre>
      </div>
    </div>
    ` : ''}

    ${selectedRequest.response.body ? `
    <div class="section collapsible ${mergedResponse || isChunked || hasCompleteResponse || hasCompleteAnthropicResponse ? 'collapsed' : ''}">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">${mergedResponse || isChunked || hasCompleteResponse || hasCompleteAnthropicResponse ? '▶' : '▼'}</span>
        <span>Response Body ${mergedResponse || isChunked || hasCompleteResponse || hasCompleteAnthropicResponse ? '(Raw)' : ''}</span>
      </div>
      <div class="section-body" ${mergedResponse || isChunked || hasCompleteResponse || hasCompleteAnthropicResponse ? 'style="display: none;"' : ''}>
        <pre>${escapeHtml(JSON.stringify(selectedRequest.response.body, null, 2))}</pre>
      </div>
    </div>
    ` : ''}
  `;
}

function renderOpenAIResponseBody(response) {
  // Choices card
  const choicesHtml = response.choices && response.choices.length > 0 ? `
    <div class="section collapsible">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▼</span>
        <span>Choices</span>
      </div>
      <div class="section-body">
        ${response.choices.map((choice, idx) => `
          <div class="message-item">
            <div class="message-header">
              <div>
                <strong>Choice ${choice.index !== undefined ? choice.index : idx}</strong>
                ${choice.message?.role ? ` - ${choice.message.role}` : ''}
              </div>
              ${choice.finish_reason ? `<span>finish_reason: <span class="badge">${choice.finish_reason}</span></span>` : ''}
            </div>
            ${choice.message ? `
              <div class="choice-content">
                ${choice.message.content ? `
                  <div class="choice-field">
                    <div class="choice-label">Content</div>
                    <div class="choice-value"><pre>${choice.message.content}</pre></div>
                  </div>
                ` : ''}
                ${choice.message.refusal ? `
                  <div class="choice-field">
                    <div class="choice-label">Refusal</div>
                    <div class="choice-value"><pre>${choice.message.refusal}</pre></div>
                  </div>
                ` : ''}
                ${Object.entries(choice.message)
                  .filter(([key]) => !['role', 'content', 'refusal', 'tool_calls'].includes(key))
                  .map(([key, value]) => `
                    <div class="choice-field">
                      <div class="choice-label">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                      <div class="choice-value"><pre>${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</pre></div>
                    </div>
                  `).join('')}
                ${choice.message.tool_calls && choice.message.tool_calls.length > 0 ? `
                  <div class="choice-field">
                    <div class="choice-label">Tool Calls</div>
                    <div class="choice-value">
                      ${choice.message.tool_calls.map(tc => `
                        <div class="tool-item">
                          <div class="tool-header">
                            <div>
                              <strong>${tc.type || 'function'}: ${tc.function?.name || 'Unknown'}</strong>
                              ${tc.index !== undefined ? `<span class="badge" style="margin-left: 8px;">Index: ${tc.index}</span>` : ''}
                            </div>
                            ${tc.id ? `<span class="tool-id">${tc.id}</span>` : ''}
                          </div>
                          ${tc.function?.arguments ? `
                            <div class="tool-args">
                              <strong>Arguments:</strong>
                              <pre>${escapeHtml(JSON.stringify(tc.function.arguments, null, 2))}</pre>
                            </div>
                          ` : ''}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // Metadata card
  const metadata = {};
  if (response.id) metadata.ID = response.id;
  if (response.object) metadata.Object = response.object;
  if (response.created) metadata.Created = new Date(response.created * 1000).toISOString();
  if (response.model) metadata.Model = response.model;
  if (response.usage) {
    if (response.usage.prompt_tokens) metadata['Prompt Tokens'] = response.usage.prompt_tokens;
    if (response.usage.completion_tokens) metadata['Completion Tokens'] = response.usage.completion_tokens;
    if (response.usage.total_tokens) metadata['Total Tokens'] = response.usage.total_tokens;
  }

  const metadataHtml = Object.keys(metadata).length > 0 ? `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Metadata</span>
      </div>
      <div class="section-body" style="display: none;">
        ${Object.entries(metadata).map(([key, value]) => `
          <div class="info-row">
            <div class="info-label">${key}</div>
            <div class="info-value">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return choicesHtml + metadataHtml;
}

function renderAnthropicResponseBody(response) {
  // Content section
  const contentHtml = response.content && response.content.length > 0 ? `
    <div class="section collapsible">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▼</span>
        <span>Content</span>
      </div>
      <div class="section-body">
        ${response.content.map((block, idx) => {
          switch (block.type) {
            case 'text':
              return `
                <div class="message-item">
                  <div class="message-header">
                    <strong>Text Block ${idx}</strong>
                  </div>
                  <div class="choice-content">
                    <div class="choice-field">
                      <div class="choice-value"><pre>${escapeHtml(block.text || '')}</pre></div>
                    </div>
                  </div>
                </div>
              `;
            case 'tool_use':
              return `
                <div class="message-item">
                  <div class="message-header">
                    <div>
                      <strong>Tool Use: ${block.name || 'Unknown'}</strong>
                    </div>
                    ${block.id ? `<span class="tool-id">${block.id}</span>` : ''}
                  </div>
                  <div class="choice-content">
                    ${block.input ? `
                      <div class="choice-field">
                        <div class="choice-label">Input</div>
                        <div class="choice-value"><pre>${escapeHtml(typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2))}</pre></div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            default:
              return `
                <div class="message-item">
                  <div class="message-header">
                    <strong>${block.type || 'Unknown'} Block ${idx}</strong>
                  </div>
                  <div class="choice-content">
                    <div class="choice-field">
                      <div class="choice-value"><pre>${escapeHtml(JSON.stringify(block, null, 2))}</pre></div>
                    </div>
                  </div>
                </div>
              `;
          }
        }).join('')}
      </div>
    </div>
  ` : '';

  // Metadata section
  const metadata = {};
  if (response.id) metadata.ID = response.id;
  if (response.model) metadata.Model = response.model;
  if (response.role) metadata.Role = response.role;
  if (response.stop_reason) metadata['Stop Reason'] = response.stop_reason;
  if (response.usage) {
    if (response.usage.input_tokens !== undefined) metadata['Input Tokens'] = response.usage.input_tokens;
    if (response.usage.output_tokens !== undefined) metadata['Output Tokens'] = response.usage.output_tokens;
    if (response.usage.cache_read_input_tokens !== undefined) metadata['Cache Read Tokens'] = response.usage.cache_read_input_tokens;
    if (response.usage.cache_creation_input_tokens !== undefined) metadata['Cache Creation Tokens'] = response.usage.cache_creation_input_tokens;
  }

  const metadataHtml = Object.keys(metadata).length > 0 ? `
    <div class="section collapsible collapsed">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▶</span>
        <span>Metadata</span>
      </div>
      <div class="section-body" style="display: none;">
        ${Object.entries(metadata).map(([key, value]) => `
          <div class="info-row">
            <div class="info-label">${key}</div>
            <div class="info-value">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return contentHtml + metadataHtml;
}

function mergeOpenAIStreamingResponse(responseBody) {
  if (!responseBody || !Array.isArray(responseBody)) {
    return null;
  }

  // Initialize the merged response structure
  const merged = {
    choices: [],
    usage: null
  };

  const choicesMap = new Map();
  
  // Process each chunk
  for (const chunk of responseBody) {
    // Handle SSE format (event/data structure)
    let data = chunk;
    if (chunk.data) {
      data = chunk.data;
    }

    // Skip if not an object
    if (!data || typeof data !== 'object') {
      continue;
    }

    // Skip [DONE] messages
    if (data === '[DONE]' || (typeof data === 'string' && data === '[DONE]')) {
      continue;
    }

    // Copy all top-level fields (except choices which we'll merge specially)
    for (const [key, value] of Object.entries(data)) {
      if (key === 'choices') {
        // Handle choices separately below
        continue;
      } else if (key === 'usage') {
        // Always take the latest usage info
        merged.usage = value;
      } else if (merged[key] === undefined) {
        // Set field if not already set (take first occurrence)
        merged[key] = value;
      }
    }

    // Merge choices
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        const index = choice.index || 0;
        
        if (!choicesMap.has(index)) {
          choicesMap.set(index, {
            index: index,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: []
            },
            finish_reason: null
          });
        }

        const mergedChoice = choicesMap.get(index);

        // Merge delta content
        if (choice.delta) {
          // Handle role
          if (choice.delta.role) {
            mergedChoice.message.role = choice.delta.role;
          }
          
          // Handle content (concatenate)
          if (choice.delta.content) {
            mergedChoice.message.content += choice.delta.content;
          }
          
          // Handle refusal (concatenate)
          if (choice.delta.refusal) {
            if (!mergedChoice.message.refusal) {
              mergedChoice.message.refusal = '';
            }
            mergedChoice.message.refusal += choice.delta.refusal;
          }
          
          // Handle tool_calls
          if (choice.delta.tool_calls) {
            // Ensure tool_calls_map exists
            if (!mergedChoice.tool_calls_map) {
              mergedChoice.tool_calls_map = new Map();
            }
            
            for (const toolCall of choice.delta.tool_calls) {
              const tcIndex = toolCall.index !== undefined ? toolCall.index : 0;
              
              // Get or create tool call at this index
              if (!mergedChoice.tool_calls_map.has(tcIndex)) {
                mergedChoice.tool_calls_map.set(tcIndex, {
                  id: null,
                  type: 'function',
                  function: {
                    name: '',
                    arguments: ''
                  }
                });
              }

              const mergedToolCall = mergedChoice.tool_calls_map.get(tcIndex);
              
              if (toolCall.id) {
                mergedToolCall.id = toolCall.id;
              }
              if (toolCall.type) {
                mergedToolCall.type = toolCall.type;
              }
              if (toolCall.function) {
                if (toolCall.function.name) {
                  mergedToolCall.function.name += toolCall.function.name;
                }
                if (toolCall.function.arguments) {
                  mergedToolCall.function.arguments += toolCall.function.arguments;
                }
              }
            }
          }
          
          // Handle any other delta fields (like reasoning_content, etc.)
          for (const [key, value] of Object.entries(choice.delta)) {
            if (key !== 'role' && key !== 'content' && key !== 'refusal' && key !== 'tool_calls') {
              // For string fields, concatenate; for others, take the value
              if (typeof value === 'string') {
                if (!mergedChoice.message[key]) {
                  mergedChoice.message[key] = '';
                }
                mergedChoice.message[key] += value;
              } else if (mergedChoice.message[key] === undefined) {
                mergedChoice.message[key] = value;
              }
            }
          }
        }

        // Set finish reason
        if (choice.finish_reason) {
          mergedChoice.finish_reason = choice.finish_reason;
        }
        
        // Copy any other choice-level fields
        for (const [key, value] of Object.entries(choice)) {
          if (key !== 'index' && key !== 'delta' && key !== 'finish_reason' && mergedChoice[key] === undefined) {
            mergedChoice[key] = value;
          }
        }
      }
    }
  }

  // Convert choices map to array and clean up
  merged.choices = Array.from(choicesMap.values()).sort((a, b) => a.index - b.index);
  
  // Convert tool_calls_map to array and clean up
  for (const choice of merged.choices) {
    // Convert tool_calls_map to sorted array
    if (choice.tool_calls_map) {
      choice.message.tool_calls = Array.from(choice.tool_calls_map.entries())
        .sort((a, b) => a[0] - b[0])  // Sort by index
        .map(([index, toolCall]) => ({
          index: index,  // Preserve the index
          ...toolCall
        }));
      delete choice.tool_calls_map;
    }
    
    // Remove empty tool_calls or parse JSON arguments
    if (choice.message.tool_calls.length === 0) {
      delete choice.message.tool_calls;
    } else {
      // Parse JSON arguments
      for (const toolCall of choice.message.tool_calls) {
        try {
          toolCall.function.arguments = JSON.parse(toolCall.function.arguments);
        } catch {
          // Keep as string if not valid JSON
        }
      }
    }
  }

  // Only return merged response if we actually merged something
  if (merged.choices.length === 0) {
    return null;
  }

  return merged;
}

function mergeAnthropicStreamingResponse(responseBody) {
  if (!responseBody || !Array.isArray(responseBody)) {
    return null;
  }

  const merged = {
    id: null,
    model: null,
    role: 'assistant',
    content: [],
    stop_reason: null,
    usage: null,
  };

  const contentBlocks = new Map(); // index -> block

  for (const chunk of responseBody) {
    let data = chunk.data || chunk;
    if (!data || typeof data !== 'object') continue;
    if (data === '[DONE]' || (typeof data === 'string' && data === '[DONE]')) continue;

    const eventType = chunk.event || data.type;

    switch (eventType) {
      case 'message_start': {
        const msg = data.message || data;
        if (msg.id) merged.id = msg.id;
        if (msg.model) merged.model = msg.model;
        if (msg.role) merged.role = msg.role;
        if (msg.usage) {
          merged.usage = { ...(merged.usage || {}), ...msg.usage };
        }
        break;
      }

      case 'content_block_start': {
        const index = data.index;
        const block = data.content_block || {};
        contentBlocks.set(index, { ...block });
        break;
      }

      case 'content_block_delta': {
        const index = data.index;
        const delta = data.delta || {};
        const block = contentBlocks.get(index);
        if (!block) break;

        if (delta.type === 'text_delta' && delta.text !== undefined) {
          block.text = (block.text || '') + delta.text;
        } else if (delta.type === 'input_json_delta' && delta.partial_json !== undefined) {
          block._raw_json = (block._raw_json || '') + delta.partial_json;
        }
        break;
      }

      case 'content_block_stop': {
        const index = data.index;
        const block = contentBlocks.get(index);
        if (block && block._raw_json) {
          try {
            block.input = JSON.parse(block._raw_json);
          } catch {
            block.input = block._raw_json;
          }
          delete block._raw_json;
        }
        break;
      }

      case 'message_delta': {
        const delta = data.delta || {};
        if (delta.stop_reason) merged.stop_reason = delta.stop_reason;
        if (data.usage) {
          merged.usage = { ...(merged.usage || {}), ...data.usage };
        }
        break;
      }

      case 'message_stop':
        // Final event, nothing more to merge
        break;
    }
  }

  // Convert content blocks map to sorted array
  merged.content = Array.from(contentBlocks.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, block]) => block);

  // Only return if we actually merged something
  if (!merged.id && merged.content.length === 0) {
    return null;
  }

  return merged;
}

function mergeGenericStreamingResponse(responseBody) {
  if (!responseBody || !Array.isArray(responseBody)) {
    return null;
  }

  // Extract all 'data' fields from the chunks
  const dataItems = [];
  for (const chunk of responseBody) {
    if (chunk.data && typeof chunk.data === 'object') {
      dataItems.push(chunk.data);
    } else if (typeof chunk === 'object' && !chunk.event && !chunk.data) {
      // It's already a data object without the wrapper
      dataItems.push(chunk);
    }
  }

  if (dataItems.length === 0) {
    return null;
  }

  // If there's only one item, return it directly
  if (dataItems.length === 1) {
    return dataItems[0];
  }

  // If multiple items, return as array
  return dataItems;
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`${targetTab}-panel`).classList.add('active');
  });
});

// Filter functions
function toggleFilterDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('filterOptions');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function togglePath(path) {
  if (selectedPaths.has(path)) {
    selectedPaths.delete(path);
  } else {
    selectedPaths.add(path);
  }
  saveFilterSelections();
  renderRequestList();
  // Keep dropdown open after selection
  const dropdown = document.getElementById('filterOptions');
  if (dropdown) {
    dropdown.style.display = 'block';
  }
}

function selectAllPaths() {
  selectedPaths.clear();
  saveFilterSelections();
  renderRequestList();
  // Keep dropdown open after selection
  const dropdown = document.getElementById('filterOptions');
  if (dropdown) {
    dropdown.style.display = 'block';
  }
}

// Function to return to upload view
function showUploadView() {
  dropZone.classList.remove('hidden');
  container.classList.remove('visible');
  headerUpload.classList.remove('visible');
  // Clear the file input so the same file can be uploaded again
  fileInput.value = '';
  headerFileInput.value = '';
  // Don't clear requests/selectedRequest - keep them in memory for forward navigation
}

// Function to show logs view
function showLogsView(requestsData) {
  if (requestsData) {
    requests = requestsData;
  }
  dropZone.classList.add('hidden');
  container.classList.add('visible');
  headerUpload.classList.add('visible');
  renderRequestList();
}

// Initialize history state for upload view (without hash)
const baseUrl = location.href.split('#')[0];
if (!history.state) {
  history.replaceState({ view: 'upload' }, '', baseUrl);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
  if (!event.state || event.state.view === 'upload') {
    showUploadView();
  } else if (event.state.view === 'logs') {
    showLogsView(event.state.requests);
  }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('filterOptions');
  const filterDropdown = document.querySelector('.filter-dropdown');
  if (dropdown && filterDropdown && 
      !filterDropdown.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// Navigation functions for tool calls
function navigateToToolResult(toolCallId, event) {
  event.stopPropagation();

  if (!selectedRequest || !selectedRequest.request.body) return;

  const messages = selectedRequest.request.body.messages || [];
  const isAnthropic = isAnthropicMessages(selectedRequest);

  if (isAnthropic) {
    // Anthropic: tool_result blocks are content blocks inside user messages
    const toolResultElement = document.getElementById(`tool-result-${toolCallId}`);
    if (toolResultElement) {
      // Find the parent message and expand it if collapsed
      const parentMessage = toolResultElement.closest('.message-item');
      if (parentMessage && parentMessage.classList.contains('collapsed')) {
        const header = parentMessage.querySelector('.collapsible-header');
        if (header) toggleSection(header);
      }

      setTimeout(() => {
        toolResultElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toolResultElement.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
          toolResultElement.style.backgroundColor = '';
        }, 2000);
      }, 100);
    }
  } else {
    // OpenAI: tool results are separate messages with role === 'tool'
    const toolMessageIndex = messages.findIndex(msg => msg.role === 'tool' && msg.tool_call_id === toolCallId);

    if (toolMessageIndex !== -1) {
      const targetElement = document.getElementById(`message-${toolMessageIndex}`);
      if (targetElement) {
        if (targetElement.classList.contains('collapsed')) {
          const header = targetElement.querySelector('.collapsible-header');
          if (header) toggleSection(header);
        }

        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
          targetElement.style.backgroundColor = '';
        }, 2000);
      }
    }
  }
}

function navigateToToolCall(toolCallId, event) {
  event.stopPropagation();

  if (!selectedRequest || !selectedRequest.request.body) return;

  const messages = selectedRequest.request.body.messages || [];
  const isAnthropic = isAnthropicMessages(selectedRequest);

  if (isAnthropic) {
    // Anthropic: tool_use blocks are content blocks inside assistant messages
    const toolCallElement = document.getElementById(`tool-call-${toolCallId}`);
    if (toolCallElement) {
      // Find the parent message and expand it if collapsed
      const parentMessage = toolCallElement.closest('.message-item');
      if (parentMessage && parentMessage.classList.contains('collapsed')) {
        const header = parentMessage.querySelector('.collapsible-header');
        if (header) toggleSection(header);
      }

      setTimeout(() => {
        toolCallElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toolCallElement.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
          toolCallElement.style.backgroundColor = '';
        }, 2000);
      }, 100);
    }
  } else {
    // OpenAI: tool calls are in tool_calls[] of assistant messages
    const assistantMessageIndex = messages.findIndex(msg =>
      msg.role === 'assistant' &&
      msg.tool_calls &&
      msg.tool_calls.some(tc => tc.id === toolCallId)
    );

    if (assistantMessageIndex !== -1) {
      const messageElement = document.getElementById(`message-${assistantMessageIndex}`);
      const toolCallElement = document.getElementById(`tool-call-${toolCallId}`);

      if (messageElement && toolCallElement) {
        if (messageElement.classList.contains('collapsed')) {
          const header = messageElement.querySelector('.collapsible-header');
          if (header) toggleSection(header);
        }

        setTimeout(() => {
          toolCallElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          toolCallElement.style.backgroundColor = '#fff3cd';
          setTimeout(() => {
            toolCallElement.style.backgroundColor = '';
          }, 2000);
        }, 100);
      }
    }
  }
}
