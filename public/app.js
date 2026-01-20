let requests = [];
let selectedRequest = null;
let selectedPaths = new Set(); // Track selected filter paths

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const container = document.getElementById('container');
const sidebar = document.getElementById('sidebar');
const requestPanel = document.getElementById('request-panel');
const responsePanel = document.getElementById('response-panel');

dropZone.addEventListener('click', () => fileInput.click());

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
  
  sidebar.innerHTML = '<div class="loading">Parsing logs...</div>';
  dropZone.classList.add('hidden');
  container.classList.add('visible');

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
    
    // Check if this is a chat completions request
    const isChatCompletions = req.url.includes('/chat/completions') && req.request.body && typeof req.request.body === 'object';
    
    if (isChatCompletions) {
      const summary = getChatCompletionsSummary(req);
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

function selectRequest(index) {
  selectedRequest = requests[index];
  
  document.querySelectorAll('.request-item').forEach((item, i) => {
    item.classList.toggle('selected', i === index);
  });

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

function renderRequestBody(request) {
  const body = request.request.body;
  
  if (!isOpenAIChatCompletions(request)) {
    return `
    <div class="section">
      <div class="section-header">Request Body</div>
      <div class="section-body">
        <pre>${JSON.stringify(body, null, 2)}</pre>
      </div>
    </div>
    `;
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
          <div class="message-item collapsible">
            <div class="message-role collapsible-header" onclick="toggleSection(this)">
              <div>
                <span class="toggle-icon">▼</span>
                <strong>${msg.role || 'unknown'}</strong>
              </div>
              ${msg.role === 'tool' && msg.tool_call_id ? `<span class="tool-id">${msg.tool_call_id}</span>` : ''}
            </div>
            <div class="message-body">
              ${msg.content ? `<div class="message-content">${escapeHtml(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2))}</div>` : ''}
              ${msg.tool_calls ? `
                <div class="message-tools">
                  <strong>Tool Calls:</strong>
                  <div style="margin-top: 8px;">
                    ${msg.tool_calls.map(tc => `
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
                            <pre>${typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments, null, 2)}</pre>
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
          <div class="tool-item">
            <div class="tool-header">
              <strong>${tool.type || 'function'}</strong>
              ${tool.function?.name ? `: ${tool.function.name}` : ''}
            </div>
            ${tool.function?.description ? `<div class="tool-description">${escapeHtml(tool.function.description)}</div>` : ''}
            ${tool.function?.parameters ? `<div class="tool-params"><pre>${JSON.stringify(tool.function.parameters, null, 2)}</pre></div>` : ''}
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
            <div class="info-value">${typeof value === 'object' ? `<pre>${JSON.stringify(value, null, 2)}</pre>` : escapeHtml(String(value))}</div>
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
        <pre>${JSON.stringify(body, null, 2)}</pre>
      </div>
    </div>
  `;
}

function toggleSection(header) {
  const section = header.parentElement;
  const body = section.querySelector('.section-body');
  const icon = header.querySelector('.toggle-icon');
  
  if (section.classList.contains('collapsed')) {
    section.classList.remove('collapsed');
    body.style.display = 'block';
    icon.textContent = '▼';
  } else {
    section.classList.add('collapsed');
    body.style.display = 'none';
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
  const isChunked = Array.isArray(selectedRequest.response.body);
  
  // Try to merge if it's OpenAI OR if it's any chunked response with SSE format
  let mergedResponse = null;
  if (isChunked && selectedRequest.response.body.length > 0) {
    if (isOpenAI) {
      mergedResponse = mergeOpenAIStreamingResponse(selectedRequest.response.body);
    } else {
      // For non-OpenAI chunked responses, try to extract and merge 'data' fields
      mergedResponse = mergeGenericStreamingResponse(selectedRequest.response.body);
    }
  }

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

    ${mergedResponse ? `
    <div class="section collapsible ${isOpenAI ? 'collapsed' : ''}">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">${isOpenAI ? '▶' : '▼'}</span>
        <span>Response Body (Merged)</span>
      </div>
      <div class="section-body" ${isOpenAI ? 'style="display: none;"' : ''}>
        <pre>${JSON.stringify(mergedResponse, null, 2)}</pre>
      </div>
    </div>
    ` : ''}

    ${selectedRequest.response.body ? `
    <div class="section collapsible ${mergedResponse || isChunked ? 'collapsed' : ''}">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">${mergedResponse || isChunked ? '▶' : '▼'}</span>
        <span>Response Body ${mergedResponse || isChunked ? '(Raw)' : ''}</span>
      </div>
      <div class="section-body" ${mergedResponse || isChunked ? 'style="display: none;"' : ''}>
        <pre>${JSON.stringify(selectedRequest.response.body, null, 2)}</pre>
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
                              <pre>${JSON.stringify(tc.function.arguments, null, 2)}</pre>
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

function mergeOpenAIStreamingResponse(responseBody) {
  if (!responseBody || !Array.isArray(responseBody)) {
    return null;
  }

  // Initialize the merged response structure
  const merged = {
    id: null,
    object: 'chat.completion',
    created: null,
    model: null,
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

    // Set metadata from first chunk
    if (data.id && !merged.id) {
      merged.id = data.id;
    }
    if (data.created && !merged.created) {
      merged.created = data.created;
    }
    if (data.model && !merged.model) {
      merged.model = data.model;
    }
    if (data.usage) {
      merged.usage = data.usage;
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
          if (choice.delta.role) {
            mergedChoice.message.role = choice.delta.role;
          }
          if (choice.delta.content) {
            mergedChoice.message.content += choice.delta.content;
          }
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
        }

        // Set finish reason
        if (choice.finish_reason) {
          mergedChoice.finish_reason = choice.finish_reason;
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
  renderRequestList();
  // Keep dropdown open after selection
  const dropdown = document.getElementById('filterOptions');
  if (dropdown) {
    dropdown.style.display = 'block';
  }
}

function selectAllPaths() {
  selectedPaths.clear();
  renderRequestList();
  // Keep dropdown open after selection
  const dropdown = document.getElementById('filterOptions');
  if (dropdown) {
    dropdown.style.display = 'block';
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('filterOptions');
  const filterDropdown = document.querySelector('.filter-dropdown');
  if (dropdown && filterDropdown && 
      !filterDropdown.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});
