import { t } from '../locales/i18n.js';
import { showToast } from '../utils/toast.js';
import { decryptData, hexToBuf, base64ToArrayBuffer } from '../utils/crypto.js';
import { apiFetch } from '../api.js';
import { formatBytes } from '../utils/format.js';
import { copyToClipboard } from '../utils/clipboard.js';

export async function renderViewSecret({ id, key }) {
  const appContainer = document.getElementById('app');
  appContainer.innerHTML = `
    <div class="card" id="view-secret-card">
      <h2 class="card-title">${t('view.loadingTitle')}</h2>
      <p class="card-desc">${t('view.loadingDesc')}</p>
      <div style="text-align:center; padding: 2rem;">
        <span style="font-size:2.5rem; display:inline-block; animation:spin 1s infinite linear;">🔄</span>
      </div>
    </div>
  `;

  try {
    const response = await apiFetch(`/api/secrets/${id}`);
    if (response.status === 404) {
      appContainer.innerHTML = `
        <div class="card">
          <h2 class="card-title">${t('view.notFoundTitle')}</h2>
          <p class="card-desc">${t('view.notFoundDesc')}</p>
          <a href="#/" class="btn btn-secondary">${t('view.homeBtn')}</a>
        </div>
      `;
      return;
    }

    const secretDto = await response.json();

    const ciphertextBytes = new Uint8Array(base64ToArrayBuffer(secretDto.encryptedData));
    const ivBytes = new Uint8Array(base64ToArrayBuffer(secretDto.iv));
    const rawKeyBytes = hexToBuf(key);

    const decryptedBytes = await decryptData(ciphertextBytes, rawKeyBytes, ivBytes);

    let displayAreaHtml = '';
    const isFile = secretDto.fileName && secretDto.fileName.length > 0;

    if (isFile) {
      displayAreaHtml = `
        <div style="text-align:center; padding: 1.5rem;">
          <span style="font-size: 3rem; display:block; margin-bottom:1rem;">📁</span>
          <p style="font-weight:600; font-size:1.1rem; margin-bottom:0.5rem;">${escapeHtml(secretDto.fileName)}</p>
          <p class="card-desc">${t('create.fileLabel')}: ${escapeHtml(secretDto.contentType)} (${formatBytes(decryptedBytes.length)})</p>
          <button id="download-file-btn" class="btn btn-primary" style="margin-top:1rem;">${t('view.downloadBtn')}</button>
        </div>
      `;
    } else {
      const text = new TextDecoder().decode(decryptedBytes);
      displayAreaHtml = `
        <label class="form-label">${t('view.decryptedLabel')}</label>
        <div class="decrypted-secret-box">${escapeHtml(text)}</div>
        <div style="display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;">
          <button id="copy-secret-text-btn" class="btn btn-secondary">${t('view.copyBtn')}</button>
          <button id="download-file-btn" class="btn btn-primary">${t('view.downloadBtn')}</button>
        </div>
      `;
    }

    let onetimeAlertHtml = '';
    if (secretDto.isOneTime) {
      onetimeAlertHtml = `
        <div class="danger-alert-box">
          <span>⚠️</span>
          <span>${t('view.onetimeAlert')}</span>
        </div>
      `;
    }

    appContainer.innerHTML = `
      <div class="card">
        <h2 class="card-title">${t('view.decryptSuccess')}</h2>
        <p class="card-desc" style="margin-bottom:1.5rem;">${t('view.decryptDesc')}</p>
        
        ${onetimeAlertHtml}
        ${displayAreaHtml}

        <div style="margin-top: 2rem; border-top: 1px solid var(--card-border); padding-top: 1.5rem;">
          <a href="#/" class="btn btn-secondary">${t('home.createBtn')}</a>
        </div>
      </div>
    `;

    if (isFile) {
      document.getElementById('download-file-btn').onclick = () => {
        const blob = new Blob([decryptedBytes], { type: secretDto.contentType });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = secretDto.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      };
    } else {
      document.getElementById('copy-secret-text-btn').onclick = async () => {
        const textElement = document.querySelector('.decrypted-secret-box');
        const success = await copyToClipboard(textElement.innerText);
        if (success) {
          showToast(t('toast.copySuccess'), "success");
        }
      };
      document.getElementById('download-file-btn').onclick = () => {
        const textElement = document.querySelector('.decrypted-secret-box');
        const blob = new Blob([decryptedBytes], { type: 'text/plain' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'secret.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      };
    }

  } catch (err) {
    console.error("[DecryptionError]", err);
    appContainer.innerHTML = `
      <div class="card">
        <h2 class="card-title">${t('view.decryptErrorTitle')}</h2>
        <p class="card-desc">${t('view.decryptErrorDesc')}</p>
        <a href="#/" class="btn btn-secondary">${t('view.homeBtn')}</a>
      </div>
    `;
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
