/**
 * CloudDrop — Share Page Logic
 * Renders shared content (files, images, videos, text) from a share code
 * Powered by Firebase (Firestore)
 */

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
const retrieveCodeInput = $('#retrieveCodeInput');
const retrieveBtn = $('#retrieveBtn');

let shareData = null;

// ===== Process Overlay Helper =====
async function setProcessStep(stepNumber, text, delayMs = 600) {
    const stepsContainer = $('#processSteps');
    if (!stepsContainer) return;

    if (stepNumber === 1) stepsContainer.innerHTML = '';

    const prevStep = $(`#step-${stepNumber - 1}`);
    if (prevStep) {
        prevStep.classList.remove('active');
        prevStep.classList.add('completed');
    }

    const stepEl = document.createElement('div');
    stepEl.id = `step-${stepNumber}`;
    stepEl.className = 'process-step active';
    stepEl.innerHTML = `
    <div class="step-indicator"><span class="step-number">${stepNumber}</span></div>
    <div class="step-text">${text}</div>
  `;
    stepsContainer.appendChild(stepEl);

    // Artificial delay for playful visual effect
    await new Promise(r => setTimeout(r, delayMs));
}

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
    const icons = { image: '🖼️', video: '🎬', text: '📄', document: '📑', archive: '📦', executable: '⚙️', other: '📎' };
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

// ===== Fetch Share Data from Firebase =====
async function loadShare(code) {
    showLoading();

    try {
        // Fetch from Firestore
        const doc = await db.collection('shares').doc(code).get();

        if (!doc.exists) {
            showError();
            return;
        }

        shareData = doc.data();
        shareData.shareCode = code;

        // Check if expired
        if (shareData.expiry && shareData.expiry > 0) {
            const expiresAt = shareData.created + (shareData.expiry * 1000);
            if (Date.now() > expiresAt) {
                showError();
                return;
            }
        }

        displayShare(shareData);
    } catch (err) {
        console.error('Error loading share:', err);
        showError();
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

        const catIcons = { image: '🖼️ Image', video: '🎬 Video', text: '📄 Text', document: '📑 Document', archive: '📦 Archive', executable: '⚙️ Program', other: '📎 File' };
        shareType.innerHTML = catIcons[file.category] || '📎 File';
        shareSize.textContent = formatSize(file.size);
        shareExpiry.textContent = formatExpiry(data.expiry, data.created);

        // The Base64 Data URL might be chunked
        let downloadURL = file.dataURL;

        // Show loading indicator while setting up
        renderGenericContent(file.name, file.size, file.category);

        const setupDownloadAndRender = (url) => {
            if (url) {
                // Render preview based on category
                if (file.category === 'image') {
                    renderImageContent(url, file.name);
                } else if (file.category === 'video') {
                    renderVideoContent(url, file.type);
                }

                // Set up download button
                downloadBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name; 
                    a.click();
                    showToast('Download started!', 'success');
                };
            } else {
                showError();
            }
        };

        if (file.isChunked && file.chunkIds) {
            // Show playful overlay for downloading
            const overlay = $('#processOverlay');
            if (overlay) overlay.classList.add('active');

            const processDownload = async () => {
                try {
                    await setProcessStep(1, "Connecting to Firestore...", 600);
                    
                    const chunkPromises = file.chunkIds.map(chunkId => 
                        db.collection('shares').doc(shareCode).collection('chunks').doc(chunkId).get()
                    );

                    await setProcessStep(2, "Downloading scattered chunks...", 1200);

                    const chunkDocs = await Promise.all(chunkPromises);
                    
                    await setProcessStep(3, "Reassembling & Decoding Base64...", 800);

                    // Sort chunks by index to ensure correct reassembly
                    const chunks = chunkDocs.map(doc => doc.data());
                    chunks.sort((a, b) => a.index - b.index);
                    
                    downloadURL = chunks.map(c => c.data).join('');
                    
                    await setProcessStep(4, "File Ready!", 500);

                    setupDownloadAndRender(downloadURL);

                    // Hide overlay
                    if (overlay) {
                        const lastStep = $('#step-4');
                        if (lastStep) {
                            lastStep.classList.remove('active');
                            lastStep.classList.add('completed');
                        }
                        await new Promise(r => setTimeout(r, 400));
                        overlay.classList.remove('active');
                    }

                } catch (err) {
                    console.error("Failed to load chunks:", err);
                    if (overlay) overlay.classList.remove('active');
                    showError();
                }
            };

            processDownload();
        } else {
            // Legacy files (non-chunked)
            setupDownloadAndRender(downloadURL);
        }

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
let shareCode = urlParams.get('code');

// Fallback to hash if query parameter was dropped by a redirect
if (!shareCode && window.location.hash) {
    shareCode = window.location.hash.substring(1);
    // If it includes query parameters by mistake, split them off
    if (shareCode.includes('?')) {
        shareCode = shareCode.split('?')[0];
    }
}

if (shareCode) {
    loadShare(shareCode);
} else {
    showError();
}

// ===== Retrieval Logic =====
function handleRetrieval() {
  const code = retrieveCodeInput.value.trim();
  if (!code) {
    showToast('Please enter a share code.', 'info');
    return;
  }

  // Redirect to share.html with the code
  window.location.href = `share.html?code=${code}#${code}`;
}

retrieveBtn.addEventListener('click', handleRetrieval);
retrieveCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleRetrieval();
  }
});
