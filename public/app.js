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

  requestPanel.innerHTML = `
    <div class="section">
      <div class="section-header">General</div>
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

    <div class="section">
      <div class="section-header">Request Headers</div>
      <div class="section-body">
        ${Object.entries(selectedRequest.request.headers).map(([key, value]) => `
          <div class="info-row">
            <div class="info-label">${key}</div>
            <div class="info-value">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${selectedRequest.request.body ? `
    <div class="section">
      <div class="section-header">Request Body</div>
      <div class="section-body">
        <pre>${JSON.stringify(selectedRequest.request.body, null, 2)}</pre>
      </div>
    </div>
    ` : ''}
  `;
}

function renderResponseDetails() {
  if (!selectedRequest) return;

  responsePanel.innerHTML = `
    <div class="section">
      <div class="section-header">Response Headers</div>
      <div class="section-body">
        ${Object.entries(selectedRequest.response.headers).map(([key, value]) => `
          <div class="info-row">
            <div class="info-label">${key}</div>
            <div class="info-value">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${selectedRequest.response.body ? `
    <div class="section">
      <div class="section-header">Response Body</div>
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
