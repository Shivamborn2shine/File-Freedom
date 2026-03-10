/**
 * CloudDrop — Share Page Logic
 * Renders shared content (files, images, videos, text) from a share code
 */

// ===== Configuration =====
const CONFIG = {
    API_BASE: 'https://wr25rqxcl3.execute-api.ap-south-1.amazonaws.com/Prod',
};

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const loadingState = $('#loadingState');
const errorState = $('#errorState');
const contentState = $('#contentState');
const shareTitle = $('#shareTitle');
const shareType = $('#shareType');
const shareSize = $('#shareSize');
const shareExpiry = $('#shareExpiry');
const previewContent = $('#previewContent');
const downloadBtn = $('#downloadBtn');
const copyShareBtn = $('#copyShareBtn');
const toastContainer = $('#toastContainer');

let shareData = null;

// ===== Toast =====
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ===== Format Helpers =====
function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatExpiry(expirySeconds, createdTimestamp) {
    if (!expirySeconds || expirySeconds === 0) return '♾️ Never expires';
    const expiresAt = createdTimestamp + (expirySeconds * 1000);
    const now = Date.now();
    const remaining = expiresAt - now;

    if (remaining <= 0) return '⚠️ Expired';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `⏰ Expires in ${days}d ${hours % 24}h`;
    if (hours > 0) return `⏰ Expires in ${hours}h`;
    const minutes = Math.floor(remaining / (1000 * 60));
    return `⏰ Expires in ${minutes}m`;
}

// ===== Render Content =====
function renderTextContent(text) {
    // Escape HTML entities
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    previewContent.innerHTML = `<pre>${escaped}</pre>`;
}

function renderImageContent(url, fileName) {
    previewContent.innerHTML = `
    <img src="${url}" alt="${fileName}" loading="lazy" 
         style="width:100%; max-height:600px; object-fit:contain; border-radius:var(--radius-md);" />
  `;
}

function renderVideoContent(url, fileType) {
    previewContent.innerHTML = `
    <video controls autoplay muted playsinline
           style="width:100%; max-height:600px; border-radius:var(--radius-md);">
      <source src="${url}" type="${fileType}" />
      Your browser does not support the video tag.
    </video>
  `;
}

function renderGenericContent(fileName, fileSize, category) {
    const icons = { image: '🖼️', video: '🎬', text: '📄', document: '📑', other: '📎' };
    previewContent.innerHTML = `
    <div style="text-align:center; padding:40px;">
      <span style="font-size:4rem; display:block; margin-bottom:16px;">${icons[category] || '📎'}</span>
      <h3 style="margin-bottom:8px;">${fileName}</h3>
      <p style="color:var(--text-secondary);">${formatSize(fileSize)}</p>
      <p style="color:var(--text-muted); font-size:0.85rem; margin-top:8px;">Click Download to save this file</p>
    </div>
  `;
}

// ===== Show States =====
function showLoading() {
    loadingState.style.display = 'block';
    errorState.style.display = 'none';
    contentState.style.display = 'none';
}

function showError() {
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
    contentState.style.display = 'none';
}

function showContent() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    contentState.style.display = 'block';
}

// ===== Fetch Share Data =====
async function loadShare(code) {
    showLoading();

    try {
        // Try API first
        const response = await fetch(`${CONFIG.API_BASE}/share/${code}`);
        if (!response.ok) throw new Error('API error');
        shareData = await response.json();
        displayShare(shareData);
    } catch (apiErr) {
        console.log('API unavailable, checking localStorage demo data...');

        // DEMO MODE: Check localStorage
        const demoData = localStorage.getItem(`clouddrop_${code}`);
        if (demoData) {
            shareData = JSON.parse(demoData);
            shareData.shareCode = code;
            displayShare(shareData);
        } else {
            showError();
        }
    }
}

function displayShare(data) {
    showContent();

    if (data.type === 'text') {
        // Text share
        shareTitle.textContent = 'Text Snippet';
        shareType.innerHTML = '📝 Text';
        shareSize.textContent = `${data.content.length.toLocaleString()} chars`;
        shareExpiry.textContent = formatExpiry(data.expiry, data.created);
        document.title = 'CloudDrop — Text Snippet';
        renderTextContent(data.content);

        // Download as .txt
        downloadBtn.onclick = () => {
            const blob = new Blob([data.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clouddrop-text-${data.shareCode}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Downloaded as text file!', 'success');
        };

    } else if (data.type === 'file' && data.files && data.files.length > 0) {
        // File share
        const file = data.files[0];
        shareTitle.textContent = file.name || 'Shared File';
        document.title = `CloudDrop — ${file.name || 'Shared File'}`;

        const catIcons = { image: '🖼️ Image', video: '🎬 Video', text: '📄 Text', document: '📑 Document', other: '📎 File' };
        shareType.innerHTML = catIcons[file.category] || '📎 File';
        shareSize.textContent = formatSize(file.size);
        shareExpiry.textContent = formatExpiry(data.expiry, data.created);

        // Fetch file data from download proxy (returns base64 in JSON)
        const downloadApiUrl = `${CONFIG.API_BASE}/download/${data.shareCode}`;

        // Show loading indicator while fetching file
        renderGenericContent(file.name, file.size, file.category);

        fetch(downloadApiUrl)
            .then(res => res.json())
            .then(dlData => {
                const dataUrl = `data:${dlData.fileType};base64,${dlData.fileData}`;

                // Render preview based on category
                if (file.category === 'image') {
                    renderImageContent(dataUrl, file.name);
                } else if (file.category === 'video') {
                    renderVideoContent(dataUrl, file.type);
                }
                // else keep the generic content already rendered

                // Set up download button with the data URL
                downloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = dlData.fileName || file.name;
                    a.click();
                    showToast('Download started!', 'success');
                };
            })
            .catch(err => {
                console.error('Download fetch error:', err);
                downloadBtn.onclick = () => {
                    showToast('Could not download file', 'error');
                };
            });

        // If multiple files, show a note
        if (data.files.length > 1) {
            const note = document.createElement('p');
            note.style.cssText = 'color:var(--text-muted); font-size:0.85rem; text-align:center; margin-top:12px;';
            note.textContent = `+ ${data.files.length - 1} more file(s) in this share`;
            previewContent.appendChild(note);
        }
    } else {
        showError();
    }
}

// ===== Copy Link =====
copyShareBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        copyShareBtn.innerHTML = '<span>✅</span> Copied!';
        showToast('Link copied to clipboard!', 'success');
        setTimeout(() => {
            copyShareBtn.innerHTML = '<span>📋</span> Copy Link';
        }, 2000);
    });
});

// ===== Init =====
const urlParams = new URLSearchParams(window.location.search);
const shareCode = urlParams.get('code');

if (shareCode) {
    loadShare(shareCode);
} else {
    showError();
}
