let requests = [];
let selectedRequest = null;

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

  sidebar.innerHTML = '';
  requests.forEach((req, index) => {
    const item = document.createElement('div');
    item.className = 'request-item';
    item.innerHTML = `
      <div>
        <span class="method ${req.method}">${req.method}</span>
        <span class="status-badge ${req.status >= 200 && req.status < 300 ? 'success' : 'error'}">${req.status}</span>
      </div>
      <div class="url">${new URL(req.url).pathname}</div>
      <div class="meta">${new Date(req.timestamp).toLocaleTimeString()} • ${req.duration}ms</div>
    `;
    item.addEventListener('click', () => selectRequest(index));
    sidebar.appendChild(item);
  });
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
    <div class="section collapsible">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▼</span>
        <span>General</span>
      </div>
      <div class="section-body">
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
          <div class="message-item">
            <div class="message-role"><strong>${msg.role || 'unknown'}</strong></div>
            ${msg.content ? `<div class="message-content">${escapeHtml(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2))}</div>` : ''}
            ${msg.tool_calls ? `<div class="message-tools"><strong>Tool Calls:</strong><pre>${JSON.stringify(msg.tool_calls, null, 2)}</pre></div>` : ''}
            ${msg.tool_call_id ? `<div class="message-tool-id"><strong>Tool Call ID:</strong> ${msg.tool_call_id}</div>` : ''}
            ${msg.name ? `<div class="message-name"><strong>Name:</strong> ${msg.name}</div>` : ''}
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

    ${selectedRequest.response.body ? `
    <div class="section collapsible">
      <div class="section-header collapsible-header" onclick="toggleSection(this)">
        <span class="toggle-icon">▼</span>
        <span>Response Body</span>
      </div>
      <div class="section-body">
        <pre>${JSON.stringify(selectedRequest.response.body, null, 2)}</pre>
      </div>
    </div>
    ` : ''}
  `;
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
