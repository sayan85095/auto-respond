document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusPill = document.getElementById('agentStatusPill');
  const statusText = document.getElementById('statusText');
  const autoReplyToggle = document.getElementById('autoReplyToggle');
  
  const qrContainer = document.getElementById('qrContainer');
  const qrPlaceholder = document.getElementById('qrPlaceholder');
  const qrImage = document.getElementById('qrImage');
  const infoTitle = document.getElementById('infoTitle');
  const infoDesc = document.getElementById('infoDesc');
  const btnReconnect = document.getElementById('btnReconnect');

  const statMorning = document.getElementById('statMorning');
  const statNight = document.getElementById('statNight');
  const statGeneral = document.getElementById('statGeneral');
  const statTotal = document.getElementById('statTotal');

  const activePauseInput = document.getElementById('activePauseInput');
  const botCooldownInput = document.getElementById('botCooldownInput');
  const btnSaveRules = document.getElementById('btnSaveRules');

  const morningTemplateList = document.getElementById('morningTemplateList');
  const nightTemplateList = document.getElementById('nightTemplateList');
  const generalTemplateList = document.getElementById('generalTemplateList');

  const newMorningInput = document.getElementById('newMorningInput');
  const newNightInput = document.getElementById('newNightInput');
  const newGeneralInput = document.getElementById('newGeneralInput');

  const btnAddMorning = document.getElementById('btnAddMorning');
  const btnAddNight = document.getElementById('btnAddNight');
  const btnAddGeneral = document.getElementById('btnAddGeneral');

  const simulatorForm = document.getElementById('simulatorForm');
  const simSender = document.getElementById('simSender');
  const simMessage = document.getElementById('simMessage');
  const simResult = document.getElementById('simResult');
  const simCategory = document.getElementById('simCategory');
  const simReason = document.getElementById('simReason');
  const simReplyBox = document.getElementById('simReplyBox');

  const logsContainer = document.getElementById('logsContainer');
  const emptyLogs = document.getElementById('emptyLogs');
  const btnClearLogs = document.getElementById('btnClearLogs');

  let state = {
    status: 'DISCONNECTED',
    autoReplyEnabled: true,
    qrCodeUrl: null,
    userInfo: null,
    stats: { totalReceived: 0, morningReplies: 0, nightReplies: 0, generalReplies: 0 },
    settings: { activeChatPauseMinutes: 15, botCooldownMinutes: 15 },
    templates: { morning: [], night: [], general: [] },
    logs: []
  };

  let popupShown = false;

  // Custom Toast Popup Notification
  function showSuccessPopup(name) {
    if (popupShown) return;
    popupShown = true;

    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.top = '20px';
    popup.style.right = '20px';
    popup.style.backgroundColor = '#10B981';
    popup.style.color = '#FFFFFF';
    popup.style.padding = '16px 24px';
    popup.style.borderRadius = '12px';
    popup.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.4)';
    popup.style.zIndex = '9999';
    popup.style.fontWeight = '700';
    popup.style.fontSize = '1.05rem';
    popup.style.display = 'flex';
    popup.style.alignItems = 'center';
    popup.style.gap = '12px';
    popup.style.animation = 'fadeInDown 0.5s ease-out';

    popup.innerHTML = `
      <span style="font-size: 1.6rem;">🎉</span>
      <div>
        <div style="font-weight: 800; font-size: 1.1rem;">WhatsApp Device Linked Successfully!</div>
        <div style="font-size: 0.9rem; font-weight: 500; opacity: 0.95;">Connected as: <strong>${escapeHtml(name)}</strong> (24/7 Agent Active)</div>
      </div>
    `;

    document.body.appendChild(popup);

    setTimeout(() => {
      popup.style.opacity = '0';
      popup.style.transition = 'opacity 0.5s ease';
      setTimeout(() => popup.remove(), 500);
    }, 6000);
  }

  // WebSocket Setup
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  let ws = null;

  function connectWebSocket() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to Agent WebSocket server');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'INIT_STATE' || data.type === 'STATE_UPDATE') {
          state = data.state;
          renderAll();

          if (state.status === 'READY' && state.userInfo) {
            showSuccessPopup(state.userInfo);
          } else if (state.status === 'QR_READY') {
            popupShown = false; // Reset popup trigger if re-entering QR state
          }
        } else if (data.type === 'READY_POPUP') {
          showSuccessPopup(data.userInfo || 'WhatsApp Account');
        } else if (data.type === 'LOG_ADDED') {
          if (data.log) {
            state.logs.unshift(data.log);
            renderLogItem(data.log, true);
          }
          if (data.stats) {
            state.stats = data.stats;
            renderStats();
          }
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection lost. Retrying in 3 seconds...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  connectWebSocket();

  // Render Functions
  function renderAll() {
    renderStatus();
    renderStats();
    renderRules();
    renderTemplates();
    renderLogs();
  }

  function renderStatus() {
    statusPill.className = 'status-pill';
    autoReplyToggle.checked = state.autoReplyEnabled;

    if (state.status === 'READY') {
      statusPill.classList.add('status-ready');
      statusText.textContent = `Connected (${state.userInfo || 'Active'})`;

      qrContainer.innerHTML = `
        <div style="text-align: center; color: var(--success); padding: 12px;">
          <div style="font-size: 3.8rem; margin-bottom: 8px;">✅</div>
          <p style="font-weight: 800; font-size: 1.2rem; color: var(--text-main); margin: 0;">Device Linked & Active!</p>
          <div style="margin-top: 10px; padding: 10px 16px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; display: inline-block;">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 2px 0;">CONNECTED ACCOUNT</p>
            <p style="font-size: 1.1rem; color: #10B981; font-weight: 800; margin: 0;">👤 ${escapeHtml(state.userInfo || 'Active Account')}</p>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">QR Code is permanently hidden while device is connected.</p>
        </div>
      `;
      infoTitle.textContent = `Connected: ${state.userInfo || 'WhatsApp User'}`;
      infoTitle.style.color = 'var(--success)';
      infoDesc.textContent = `Agent is active 24/7 for ${state.userInfo || 'WhatsApp User'}. Auto-replies are working automatically!`;

    } else if (state.status === 'AUTHENTICATED') {
      statusPill.classList.add('status-ready');
      statusText.textContent = 'Device Linked! Loading...';

      qrContainer.innerHTML = `
        <div class="qr-placeholder">
          <div class="spinner"></div>
          <p style="font-weight: 700; color: var(--success);">🎉 Device Linked Successfully!</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Syncing chats and profile info...</p>
        </div>
      `;
      infoTitle.textContent = 'Linking Device...';
      infoTitle.style.color = 'var(--success)';
      infoDesc.textContent = 'Device scanned successfully! Syncing profile and activating 24/7 Agent...';

    } else if (state.status === 'QR_READY' && state.qrCodeUrl) {
      statusPill.classList.add('status-qr');
      statusText.textContent = 'Scan QR Code';

      qrContainer.innerHTML = `<img id="qrImage" src="${state.qrCodeUrl}" alt="WhatsApp Web QR Code">`;
      infoTitle.textContent = 'Scan QR Code';
      infoTitle.style.color = 'var(--primary)';
      infoDesc.textContent = 'Open WhatsApp on your phone → Linked Devices → Link a Device, and scan the QR code above.';

    } else if (state.status === 'INITIALIZING') {
      statusPill.classList.add('status-qr');
      statusText.textContent = 'Starting Agent...';

      qrContainer.innerHTML = `
        <div class="qr-placeholder">
          <div class="spinner"></div>
          <p>Starting WhatsApp Client...</p>
        </div>
      `;
      infoTitle.textContent = 'Initializing...';
      infoTitle.style.color = 'var(--warning)';
      infoDesc.textContent = 'Please wait while the WhatsApp Web engine starts up.';

    } else {
      statusPill.classList.add('status-disconnected');
      statusText.textContent = 'Disconnected';

      qrContainer.innerHTML = `
        <div class="qr-placeholder">
          <div style="font-size: 2.5rem; color: var(--danger);">⚠️</div>
          <p>Agent Disconnected</p>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Auto-generating new QR Code...</p>
        </div>
      `;
      infoTitle.textContent = 'Disconnected';
      infoTitle.style.color = 'var(--danger)';
      infoDesc.textContent = 'Connection lost. Auto-generating fresh QR Code for reconnecting...';
    }
  }

  function renderStats() {
    statMorning.textContent = state.stats.morningReplies || 0;
    statNight.textContent = state.stats.nightReplies || 0;
    statGeneral.textContent = state.stats.generalReplies || 0;
    statTotal.textContent = state.stats.totalReceived || 0;
  }

  function renderRules() {
    if (state.settings) {
      activePauseInput.value = state.settings.activeChatPauseMinutes ?? 15;
      botCooldownInput.value = state.settings.botCooldownMinutes ?? 15;
    }
  }

  function renderTemplates() {
    const t = state.templates || {};
    renderTemplateGroup(generalTemplateList, t.general || [], 'general');
    renderTemplateGroup(morningTemplateList, t.morning || [], 'morning');
    renderTemplateGroup(nightTemplateList, t.night || [], 'night');
  }

  function renderTemplateGroup(container, items, key) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'template-item';
      li.innerHTML = `
        <span>${escapeHtml(item)}</span>
        <button class="template-del-btn" data-type="${key}" data-index="${index}">🗑️</button>
      `;
      container.appendChild(li);
    });
  }

  function renderLogs() {
    logsContainer.innerHTML = '';
    if (!state.logs || state.logs.length === 0) {
      logsContainer.appendChild(emptyLogs);
      return;
    }

    state.logs.forEach(log => {
      renderLogItem(log, false);
    });
  }

  function renderLogItem(log, prepend = true) {
    const existingEmpty = logsContainer.querySelector('.empty-logs');
    if (existingEmpty) existingEmpty.remove();

    const row = document.createElement('div');
    row.className = `log-row log-${log.type}`;

    row.innerHTML = `
      <span class="log-time">[${log.timestamp}]</span>
      <span class="log-title">${escapeHtml(log.title)}</span>
      <span class="log-msg">${escapeHtml(log.message)}</span>
    `;

    if (prepend && logsContainer.firstChild) {
      logsContainer.insertBefore(row, logsContainer.firstChild);
    } else {
      logsContainer.appendChild(row);
    }
  }

  // Rules Save Handler
  if (btnSaveRules) {
    btnSaveRules.addEventListener('click', async () => {
      const activeChatPauseMinutes = parseInt(activePauseInput.value, 10) || 0;
      const botCooldownMinutes = parseInt(botCooldownInput.value, 10) || 0;

      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeChatPauseMinutes, botCooldownMinutes })
        });
        alert('✅ Smart Rules saved successfully!');
      } catch (err) {
        console.error('Error saving settings:', err);
      }
    });
  }

  // Template Add Handlers
  if (btnAddGeneral) {
    btnAddGeneral.addEventListener('click', () => {
      const text = newGeneralInput.value.trim();
      if (!text) return;
      if (!state.templates.general) state.templates.general = [];
      state.templates.general.push(text);
      newGeneralInput.value = '';
      saveTemplates();
    });
  }

  if (btnAddMorning) {
    btnAddMorning.addEventListener('click', () => {
      const text = newMorningInput.value.trim();
      if (!text) return;
      if (!state.templates.morning) state.templates.morning = [];
      state.templates.morning.push(text);
      newMorningInput.value = '';
      saveTemplates();
    });
  }

  if (btnAddNight) {
    btnAddNight.addEventListener('click', () => {
      const text = newNightInput.value.trim();
      if (!text) return;
      if (!state.templates.night) state.templates.night = [];
      state.templates.night.push(text);
      newNightInput.value = '';
      saveTemplates();
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('template-del-btn')) {
      const type = e.target.getAttribute('data-type');
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      if (type && !isNaN(index) && state.templates[type]) {
        state.templates[type].splice(index, 1);
        saveTemplates();
      }
    }
  });

  async function saveTemplates() {
    renderTemplates();
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.templates)
      });
    } catch (err) {
      console.error('Error saving templates:', err);
    }
  }

  // Tab Switcher
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Toggle Switch Handler
  autoReplyToggle.addEventListener('change', async () => {
    try {
      const res = await fetch('/api/toggle-reply', { method: 'POST' });
      const data = await res.json();
      state.autoReplyEnabled = data.autoReplyEnabled;
    } catch (err) {
      console.error('Error toggling auto-reply:', err);
    }
  });

  // Reconnect Handler
  btnReconnect.addEventListener('click', async () => {
    try {
      await fetch('/api/reconnect', { method: 'POST' });
    } catch (err) {
      console.error('Error reconnecting client:', err);
    }
  });

  // Simulator Handler
  simulatorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const senderName = simSender.value.trim();
    const messageText = simMessage.value.trim();
    if (!messageText) return;

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderName, messageText })
      });
      const data = await res.json();

      if (data.success && data.result) {
        simResult.style.display = 'block';
        simCategory.textContent = data.result.category;
        simReason.textContent = data.result.reason;

        if (data.result.replyText) {
          simReplyBox.style.color = 'var(--success)';
          simReplyBox.textContent = `Replied: "${data.result.replyText}"`;
        } else {
          simReplyBox.style.color = 'var(--text-muted)';
          simReplyBox.textContent = 'No reply sent';
        }
      }
    } catch (err) {
      console.error('Error running simulator:', err);
    }
  });

  // Clear Logs Handler
  btnClearLogs.addEventListener('click', () => {
    state.logs = [];
    renderLogs();
  });

  // Utility
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
