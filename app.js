const state = {
  events: [],
  rabbitConnected: false,
  toastTimer: null,
};

const elements = {
  totalEvents: document.getElementById('total-events'),
  activeAlerts: document.getElementById('active-alerts'),
  highRisk: document.getElementById('high-risk'),
  averageRisk: document.getElementById('avg-risk'),
  highCount: document.getElementById('high-count'),
  mediumCount: document.getElementById('medium-count'),
  lowCount: document.getElementById('low-count'),
  highBar: document.getElementById('high-bar'),
  mediumBar: document.getElementById('medium-bar'),
  lowBar: document.getElementById('low-bar'),
  tableBody: document.getElementById('event-table-body'),
  tableCount: document.getElementById('table-count'),
  tableFooter: document.getElementById('table-footer-copy'),
  alertList: document.getElementById('alert-list'),
  alertBadge: document.getElementById('alert-badge'),
  searchInput: document.getElementById('search-input'),
  severityFilter: document.getElementById('severity-filter'),
  eventForm: document.getElementById('event-form'),
  submitButton: document.getElementById('submit-event'),
  simulateButton: document.getElementById('simulate-button'),
  refreshButton: document.getElementById('refresh-button'),
  toast: document.getElementById('toast'),
  headerLiveDot: document.getElementById('header-live-dot'),
  headerLiveLabel: document.getElementById('header-live-label'),
  sidebarPulse: document.getElementById('sidebar-pulse'),
  sidebarStatus: document.getElementById('sidebar-status'),
  sidebarQueueCopy: document.getElementById('sidebar-queue-copy'),
  queueTrackFill: document.getElementById('queue-track-fill'),
  navEventCount: document.getElementById('nav-event-count'),
};

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeAgo(timestamp) {
  const date = new Date(timestamp).getTime();
  if (!Number.isFinite(date)) return 'time unknown';
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function severityClass(severity) {
  return String(severity || 'Low').toLowerCase();
}

function eventIcon(event) {
  if (event.riskScore >= 70) return { symbol: '!', className: 'warning' };
  const type = String(event.eventType || '').toLowerCase();
  if (type.includes('transfer')) return { symbol: '↗', className: '' };
  if (type.includes('withdraw')) return { symbol: '↓', className: '' };
  if (type.includes('login')) return { symbol: '⌑', className: '' };
  return { symbol: '₹', className: '' };
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle('error', isError);
  elements.toast.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 3600);
}

function updateConnectionStatus(connected, streamReconnecting = false) {
  state.rabbitConnected = Boolean(connected);
  const isConnected = state.rabbitConnected;
  const label = streamReconnecting ? 'RECONNECTING' : isConnected ? 'RABBITMQ CONNECTED' : 'BROKER OFFLINE';
  elements.headerLiveLabel.textContent = label;
  elements.headerLiveLabel.style.color = streamReconnecting ? 'var(--amber)' : isConnected ? 'var(--green)' : 'var(--red)';
  elements.headerLiveDot.classList.toggle('connected', isConnected && !streamReconnecting);
  elements.headerLiveDot.classList.toggle('disconnected', !isConnected && !streamReconnecting);
  elements.sidebarPulse.classList.toggle('connected', isConnected);
  elements.sidebarPulse.classList.toggle('disconnected', !isConnected);
  elements.sidebarStatus.textContent = streamReconnecting ? 'Reconnecting' : isConnected ? 'Connected' : 'Retrying';
  elements.sidebarStatus.classList.toggle('connected', isConnected);
  elements.sidebarQueueCopy.textContent = isConnected
    ? 'Durable queue ready for new events'
    : 'Retrying connection automatically';
  elements.queueTrackFill.style.width = isConnected ? '100%' : '8%';
}

function renderMetrics(metrics = {}) {
  elements.totalEvents.textContent = metrics.totalEvents ?? state.events.length;
  elements.activeAlerts.textContent = metrics.activeAlerts ?? state.events.filter((event) => event.riskScore >= 40).length;
  elements.highRisk.textContent = metrics.highRisk ?? state.events.filter((event) => event.severity === 'High').length;
  elements.averageRisk.textContent = metrics.averageRisk ?? (state.events.length
    ? Math.round(state.events.reduce((sum, event) => sum + event.riskScore, 0) / state.events.length)
    : 0);

  const high = metrics.highRisk ?? state.events.filter((event) => event.severity === 'High').length;
  const medium = metrics.mediumRisk ?? state.events.filter((event) => event.severity === 'Medium').length;
  const low = metrics.lowRisk ?? state.events.filter((event) => event.severity === 'Low').length;
  const total = Math.max(1, high + medium + low);

  elements.highCount.textContent = high;
  elements.mediumCount.textContent = medium;
  elements.lowCount.textContent = low;
  elements.highBar.style.width = `${(high / total) * 100}%`;
  elements.mediumBar.style.width = `${(medium / total) * 100}%`;
  elements.lowBar.style.width = `${(low / total) * 100}%`;
  elements.navEventCount.textContent = state.events.length;
  elements.alertBadge.textContent = metrics.activeAlerts ?? state.events.filter((event) => event.riskScore >= 40).length;
}

function renderTable() {
  const search = elements.searchInput.value.trim().toLowerCase();
  const severity = elements.severityFilter.value;
  const filtered = state.events.filter((event) => {
    const matchesSeverity = severity === 'all' || event.severity === severity;
    const searchable = [event.id, event.userId, event.merchant, event.location, event.eventType, ...(event.reasons || [])]
      .join(' ')
      .toLowerCase();
    return matchesSeverity && searchable.includes(search);
  });

  elements.tableCount.textContent = filtered.length;
  if (!filtered.length) {
    const hasEvents = state.events.length > 0;
    elements.tableBody.innerHTML = `<tr><td colspan="6" class="empty-cell"><span class="empty-icon">⌁</span><strong>${hasEvents ? 'No matching events' : 'No events yet'}</strong><span>${hasEvents ? 'Try another search or risk level.' : 'Publish an event or use “Simulate event” to start the stream.'}</span></td></tr>`;
    elements.tableFooter.textContent = hasEvents ? 'No events match these filters' : 'Waiting for the first event';
    return;
  }

  elements.tableBody.innerHTML = filtered.slice(0, 30).map((event) => {
    const icon = eventIcon(event);
    const cls = severityClass(event.severity);
    const scoreColor = event.riskScore >= 70 ? 'var(--red)' : event.riskScore >= 40 ? 'var(--amber)' : 'var(--green)';
    return `<tr>
      <td><div class="event-cell"><span class="event-type-icon ${icon.className}">${icon.symbol}</span><div class="event-main"><strong title="${escapeHTML(event.eventType)}">${escapeHTML(event.eventType)}</strong><span>${escapeHTML(event.userId)}</span></div></div></td>
      <td title="${escapeHTML(event.location)}">${escapeHTML(event.merchant)}</td>
      <td class="amount-cell">${money.format(Number(event.amount) || 0)}</td>
      <td><span class="risk-score" style="color:${scoreColor}">${Number(event.riskScore) || 0}<span class="score-track"><span style="width:${Math.min(100, Number(event.riskScore) || 0)}%;background:${scoreColor}"></span></span></span></td>
      <td><span class="severity-badge ${cls}">${escapeHTML(event.severity)}</span></td>
      <td class="time-cell" title="${escapeHTML(event.timestamp)}">${formatTime(event.timestamp)}</td>
    </tr>`;
  }).join('');

  elements.tableFooter.textContent = `Showing ${Math.min(filtered.length, 30)} of ${filtered.length} matching event${filtered.length === 1 ? '' : 's'}`;
}

function renderAlerts() {
  const alerts = state.events.filter((event) => event.riskScore >= 40).slice(0, 6);
  if (!alerts.length) {
    elements.alertList.innerHTML = '<div class="empty-alerts"><span class="empty-alert-icon">✓</span><strong>All quiet for now</strong><span>Risk alerts will appear here when a rule is triggered.</span></div>';
    return;
  }

  elements.alertList.innerHTML = alerts.map((event) => {
    const high = event.severity === 'High';
    const cls = high ? 'high-alert' : 'medium-alert';
    const icon = high ? '!' : '◉';
    const reasons = Array.isArray(event.reasons) ? event.reasons : [];
    return `<div class="alert-item ${cls}">
      <span class="alert-item-icon">${icon}</span>
      <div class="alert-item-body">
        <div class="alert-item-head"><strong>${escapeHTML(event.merchant)}</strong><span>${Number(event.riskScore) || 0}/100</span></div>
        <p>${escapeHTML(reasons.slice(0, 2).join(' · ') || 'Risk rule triggered')}</p>
        <div class="alert-meta"><span>${escapeHTML(event.userId)}</span><span>${timeAgo(event.timestamp)}</span></div>
      </div>
    </div>`;
  }).join('');
}

function updateDashboard(payload = {}) {
  if (Array.isArray(payload.events)) state.events = payload.events;
  if (typeof payload.rabbitConnected === 'boolean') updateConnectionStatus(payload.rabbitConnected);
  renderMetrics(payload.metrics || {});
  renderTable();
  renderAlerts();
}

async function refreshDashboard(showMessage = false) {
  try {
    const response = await fetch('/api/dashboard', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load dashboard data.');
    const payload = await response.json();
    updateDashboard(payload);
    if (showMessage) showToast('Dashboard refreshed.');
  } catch (error) {
    updateConnectionStatus(false);
    if (showMessage) showToast('Cannot reach the server. Start RabbitMQ and run npm start.', true);
  }
}

async function sendEvent(payload, button = null) {
  if (button) button.disabled = true;
  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The event could not be queued.');
    showToast('Event accepted by RabbitMQ. Risk analysis is running.');
    return true;
  } catch (error) {
    showToast(error.message || 'Could not publish event.', true);
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

function randomEvent() {
  const amounts = [750, 1250, 2850, 7200, 24500, 56000, 89000];
  const locations = ['Bengaluru', 'Mumbai', 'Delhi', 'Unknown', 'New Country', 'Overseas'];
  const merchants = ['Urban Market', 'Metro Payments', 'QuickCart', 'Cloud Tickets', 'Northstar Store', 'Wallet Transfer'];
  const types = ['Purchase', 'Transfer', 'Withdrawal', 'Login', 'Account activity'];
  const users = ['user-104', 'user-218', 'user-104', 'user-563', 'user-731'];
  return {
    amount: amounts[Math.floor(Math.random() * amounts.length)],
    userId: users[Math.floor(Math.random() * users.length)],
    merchant: merchants[Math.floor(Math.random() * merchants.length)],
    location: locations[Math.floor(Math.random() * locations.length)],
    eventType: types[Math.floor(Math.random() * types.length)],
  };
}

elements.eventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    amount: Number(document.getElementById('amount').value),
    userId: document.getElementById('user-id').value.trim(),
    merchant: document.getElementById('merchant').value.trim(),
    location: document.getElementById('location').value,
    eventType: document.getElementById('event-type').value,
  };
  const success = await sendEvent(payload, elements.submitButton);
  if (success) {
    document.getElementById('amount').value = '1250';
  }
});

elements.simulateButton.addEventListener('click', async () => {
  const payload = randomEvent();
  document.getElementById('amount').value = String(payload.amount);
  document.getElementById('user-id').value = payload.userId;
  document.getElementById('merchant').value = payload.merchant;
  document.getElementById('location').value = payload.location;
  document.getElementById('event-type').value = payload.eventType;
  await sendEvent(payload, elements.simulateButton);
});

elements.refreshButton.addEventListener('click', () => refreshDashboard(true));
elements.searchInput.addEventListener('input', renderTable);
elements.severityFilter.addEventListener('change', renderTable);
document.getElementById('current-date').textContent = new Date().toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();

// Server-Sent Events keep the dashboard updated without repeated polling.
const eventStream = new EventSource('/api/stream');
eventStream.onopen = () => refreshDashboard(false);
eventStream.onmessage = (message) => {
  try {
    updateDashboard(JSON.parse(message.data));
  } catch (error) {
    console.error('Could not read live update:', error);
  }
};
eventStream.onerror = () => {
  updateConnectionStatus(false, true);
};

refreshDashboard(false);
