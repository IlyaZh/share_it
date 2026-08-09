import { t } from '../locales/i18n.js';
import { showToast } from '../utils/toast.js';
import { apiFetch, state, checkAuth } from '../api.js';
import { navigate } from '../router.js';
import { formatBytes, formatDateTime } from '../utils/format.js';
import { copyToClipboard } from '../utils/clipboard.js';

export async function renderDashboard() {
  try {
    await checkAuth();
  } catch (e) {}

  if (!state.currentUser.isAuthenticated) {
    showToast(t('toast.authWarning'), "warning");
    navigate('/login');
    return;
  }

  const appContainer = document.getElementById('app');
  appContainer.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 class="card-title" style="margin-bottom: 0.5rem;">${t('dashboard.title')}</h2>
          <p class="card-desc" style="margin-bottom: 0.5rem;">${t('dashboard.desc')}</p>
          <div id="quota-container" style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
            <span>${t('dashboard.quotaLabel')}:</span>
            <span id="quota-value" style="font-weight: 600; color: var(--text-color);">...</span>
            <div style="width: 120px; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; display: inline-block; margin-left: 0.25rem;">
              <div id="quota-bar" style="width: 0%; height: 100%; background: var(--primary-color); transition: width 0.3s ease;"></div>
            </div>
          </div>
        </div>
        <a href="#/create" class="btn btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.9rem;">${t('nav.create')}</a>
      </div>
      
      <div id="secrets-list-container" class="secret-table-container">
        <table class="secret-table">
          <thead>
            <tr>
              <th>${t('dashboard.tableComment')}</th>
              <th>${t('dashboard.tableType')}</th>
              <th>${t('dashboard.tableSize')}</th>
              <th>${t('dashboard.tableCreated')}</th>
              <th style="text-align: right;">${t('dashboard.tableActions')}</th>
            </tr>
          </thead>
          <tbody id="secrets-table-body">
            <tr id="table-loading-row">
              <td colspan="5" style="text-align:center; padding: 2rem;">
                <span style="font-size:2rem; display:inline-block; animation:spin 1s infinite linear;">🔄</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top: 2rem;">
      <h2 class="card-title" style="margin-bottom: 0.5rem;">${t('dashboard.inviteTitle')}</h2>
      <p class="card-desc" style="margin-bottom: 1.5rem;">${t('dashboard.inviteDesc')}</p>
      
      <div class="form-group" style="max-width: 450px; margin-bottom: 1.5rem;">
        <label class="form-label" for="invite-email-input">${t('dashboard.inviteEmailLabel')}</label>
        <div style="display: flex; gap: 1rem;">
          <input class="form-input" type="email" id="invite-email-input" placeholder="example@gmail.com" required>
          <button id="generate-invite-btn" class="btn btn-primary" style="white-space: nowrap;">${t('dashboard.inviteCreateBtn')}</button>
        </div>
      </div>

      <div id="invite-result-container" style="display: none; margin-bottom: 2rem;">
        <label class="form-label">${t('dashboard.inviteLabel')}</label>
        <div class="secret-link-box" style="margin-top: 0;">
          <span id="invite-link-text" class="secret-link-text"></span>
          <button id="copy-invite-btn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">${t('dashboard.inviteCopyBtn')}</button>
        </div>
      </div>

      <h3 style="margin-top: 2rem; margin-bottom: 1rem; font-size: 1.2rem; color: var(--text-color);">${t('dashboard.inviteListTitle')}</h3>
      <div id="invites-list-container" class="secret-table-container">
        <table class="secret-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>${t('dashboard.inviteTableStatus')}</th>
              <th>${t('dashboard.inviteTableCreated')}</th>
              <th style="text-align: right;">${t('dashboard.inviteTableActions')}</th>
            </tr>
          </thead>
          <tbody id="invites-table-body">
            <tr id="invites-loading-row">
              <td colspan="4" style="text-align:center; padding: 1.5rem;">
                <span style="font-size:1.5rem; display:inline-block; animation:spin 1s infinite linear;">🔄</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  updateQuotaUI();
  loadUserSecrets();
  setupInviteHandler();
  loadUserInvites();
}

function updateQuotaUI() {
  const quotaVal = document.getElementById('quota-value');
  const quotaBar = document.getElementById('quota-bar');
  if (!quotaVal || !quotaBar) return;

  const used = state.currentUser.usedBytes || 0;
  const total = state.currentUser.quotaBytes || 209715200;
  const percent = Math.min(100, Math.round((used / total) * 100));

  quotaVal.innerText = `${formatBytes(used)} / ${formatBytes(total)} (${percent}%)`;
  quotaBar.style.width = `${percent}%`;

  if (percent > 85) {
    quotaBar.style.background = 'var(--accent-color)';
  } else if (percent > 60) {
    quotaBar.style.background = '#fdcb6e';
  } else {
    quotaBar.style.background = 'var(--primary-color)';
  }
}

function setupInviteHandler() {
  const genBtn = document.getElementById('generate-invite-btn');
  if (!genBtn) return;

  genBtn.onclick = async () => {
    const emailInput = document.getElementById('invite-email-input');
    if (!emailInput) return;

    const email = emailInput.value.trim();
    if (!email) {
      showToast(t('toast.emailMissingError') || "Please enter an email address.", "warning");
      return;
    }

    genBtn.disabled = true;
    try {
      const response = await apiFetch('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const errData = await response.json();
        if (errData && errData.error) {
          if (errData.error.includes("User already registered")) {
            throw new Error("user_exists");
          }
          if (errData.error.includes("Active invite already exists")) {
            throw new Error("invite_exists");
          }
        }
        throw new Error("create_failed");
      }

      const data = await response.json();
      const inviteCode = data.code;
      
      const inviteUrl = `${window.location.origin}${window.location.pathname}#/register?invite=${inviteCode}`;
      
      const linkText = document.getElementById('invite-link-text');
      if (linkText) {
        linkText.innerText = inviteUrl;
      }
      
      const resultContainer = document.getElementById('invite-result-container');
      if (resultContainer) {
        resultContainer.style.display = 'block';
      }
      
      showToast(t('toast.inviteCreatedSuccess'), "success");
      emailInput.value = '';
      
      const copyBtn = document.getElementById('copy-invite-btn');
      if (copyBtn) {
        copyBtn.onclick = async () => {
          const success = await copyToClipboard(inviteUrl);
          if (success) {
            showToast(t('toast.copySuccess'), "success");
          }
        };
      }

      // Reload invite list
      await loadUserInvites();
    } catch (e) {
      if (e.message === "user_exists") {
        showToast(t('toast.inviteCreateUserExistsError'), "error");
      } else if (e.message === "invite_exists") {
        showToast(t('toast.inviteCreateAlreadyExistsError'), "error");
      } else {
        showToast(t('toast.inviteCreatedError'), "error");
      }
    } finally {
      genBtn.disabled = false;
    }
  };
}

async function loadUserInvites(lastInviteId = null) {
  const container = document.getElementById('invites-table-body');
  if (!container) return;

  try {
    let url = '/api/invites';
    if (lastInviteId) {
      url += `?lastInviteId=${lastInviteId}`;
    }
    const response = await apiFetch(url);
    const invites = await response.json();

    if (!lastInviteId && invites.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">
            ${t('dashboard.inviteEmptyList')}
          </td>
        </tr>
      `;
      return;
    }

    if (!lastInviteId) {
      container.innerHTML = '';
    } else {
      const pagRow = document.getElementById('invite-pagination-row');
      if (pagRow) pagRow.remove();
    }

    invites.forEach(inv => {
      const dateStr = formatDateTime(inv.createdAt);
      const statusText = inv.isUsed ? t('dashboard.inviteStatusUsed') : t('dashboard.inviteStatusActive');
      const row = document.createElement('tr');
      row.id = `invite-item-${inv.id}`;
      
      const inviteUrl = `${window.location.origin}${window.location.pathname}#/register?invite=${inv.id}`;
      
      row.innerHTML = `
        <td><span class="secret-table-comment">${escapeHtml(inv.email)}</span></td>
        <td><span class="secret-table-meta" style="${inv.isUsed ? 'color: var(--text-muted);' : 'color: var(--success-color); font-weight: 600;'}">${statusText}</span></td>
        <td><span class="secret-table-meta">${dateStr}</span></td>
        <td style="text-align: right;">
          ${!inv.isUsed ? `<button class="btn btn-secondary copy-link-btn" data-url="${inviteUrl}" style="padding:0.3rem 0.6rem; font-size:0.75rem;">${t('dashboard.inviteCopyBtn')}</button>` : ''}
        </td>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.copy-link-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        const success = await copyToClipboard(url);
        if (success) {
          showToast(t('toast.copySuccess'), "success");
        }
      };
    });

    if (invites.length === 20) {
      const lastId = invites[invites.length - 1].id;
      const paginationRow = document.createElement('tr');
      paginationRow.id = 'invite-pagination-row';
      paginationRow.innerHTML = `
        <td colspan="4" style="text-align: center; padding: 1rem;">
          <button id="load-more-invites-btn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">${t('dashboard.loadMore')}</button>
        </td>
      `;
      container.appendChild(paginationRow);

      document.getElementById('load-more-invites-btn').onclick = () => {
        loadUserInvites(lastId);
      };
    }
  } catch (e) {
    if (!lastInviteId) {
      container.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--accent-color);">
            ${t('toast.networkError')}
          </td>
        </tr>
      `;
    } else {
      showToast(t('toast.networkError'), "error");
    }
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadUserSecrets(lastSecretId = null) {
  const container = document.getElementById('secrets-table-body');
  if (!container) return;

  try {
    let url = '/api/secrets/my';
    if (lastSecretId) {
      url += `?lastSecretId=${lastSecretId}`;
    }
    const response = await apiFetch(url);
    const secrets = await response.json();

    if (!lastSecretId && secrets.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">
            ${t('dashboard.emptyList')}
          </td>
        </tr>
      `;
      return;
    }

    if (!lastSecretId) {
      container.innerHTML = '';
    } else {
      const pagRow = document.getElementById('pagination-row');
      if (pagRow) pagRow.remove();
    }

    secrets.forEach(s => {
      const secretId = s.id || s.Id;
      const dateStr = formatDateTime(s.createdAt);
      const lowerId = secretId.toLowerCase();
      const upperId = secretId.toUpperCase();
      const localKey = localStorage.getItem(`secret-key-${lowerId}`) || 
                        localStorage.getItem(`secret-key-${secretId}`) || 
                        localStorage.getItem(`secret-key-${upperId}`);
      const secretLink = localKey ? `${window.location.origin}/#/secret/${secretId}:${localKey}` : '';

      const row = document.createElement('tr');
      row.id = `secret-item-${secretId}`;
      row.innerHTML = `
        <td>
          <span class="secret-table-comment">${escapeHtml(s.comment)}</span>
        </td>
        <td>
          <span class="secret-table-meta">${s.isOneTime ? t('dashboard.metaOnetime') : t('dashboard.metaMultitime')}</span>
        </td>
        <td>
          <span class="secret-table-meta">${formatBytes(s.size)}</span>
        </td>
        <td>
          <span class="secret-table-meta">${dateStr}</span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          ${secretLink
            ? `<button class="btn btn-secondary copy-secret-link-btn" data-link="${secretLink}" style="padding:0.4rem 0.8rem; font-size:0.8rem; margin-right:0.5rem;">${t('dashboard.copyLinkBtn')}</button>`
            : `<button class="btn btn-secondary" disabled title="${t('dashboard.keyUnavailableTooltip')}" style="padding:0.4rem 0.8rem; font-size:0.8rem; margin-right:0.5rem; opacity:0.5; cursor:not-allowed;">${t('dashboard.copyLinkBtn')}</button>`}
          <button class="btn btn-danger burn-btn" data-id="${secretId}" style="padding:0.4rem 0.8rem; font-size:0.8rem;">${t('dashboard.deleteBtn')}</button>
        </td>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.copy-secret-link-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const link = e.currentTarget.getAttribute('data-link');
        const success = await copyToClipboard(link);
        if (success) {
          showToast(t('toast.copySuccess'), "success");
        }
      };
    });

    container.querySelectorAll('.burn-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        await burnSecret(id);
      };
    });

    if (secrets.length === 20) {
      const lastId = secrets[secrets.length - 1].id;
      const paginationRow = document.createElement('tr');
      paginationRow.id = 'pagination-row';
      paginationRow.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 1rem;">
          <button id="load-more-btn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">${t('dashboard.loadMore')}</button>
        </td>
      `;
      container.appendChild(paginationRow);

      document.getElementById('load-more-btn').onclick = () => {
        loadUserSecrets(lastId);
      };
    }

  } catch (e) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 2rem; color: var(--accent-color);">
          ${t('toast.networkError') || "Error loading secrets."}
        </td>
      </tr>
    `;
  }
}

async function burnSecret(id) {
  if (!confirm(t('dashboard.deleteConfirm'))) {
    return;
  }

  try {
    await apiFetch(`/api/secrets/${id}`, {
      method: 'DELETE'
    });
    showToast(t('toast.deleteSuccess'), "success");
    const item = document.getElementById(`secret-item-${id}`);
    if (item) item.remove();
    
    // Refresh storage usage details
    await checkAuth();
    updateQuotaUI();

    const container = document.getElementById('secrets-table-body');
    const remainingRows = container.querySelectorAll('tr:not(#pagination-row)').length;
    if (remainingRows === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">
            ${t('dashboard.emptyList')}
          </td>
        </tr>
      `;
    }
  } catch (e) {
    showToast(t('toast.deleteError'), "error");
  }
}
