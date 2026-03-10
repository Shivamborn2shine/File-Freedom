/**
 * CloudDrop — Main Application Logic
 * Handles file upload, text sharing, and UI interactions
 */

// ===== Configuration =====
const CONFIG = {
  // Replace with your actual API Gateway URL after deploying SAM template
  API_BASE: 'https://wr25rqxcl3.execute-api.ap-south-1.amazonaws.com/Prod',
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_TEXT_SIZE: 500000, // 500K characters
};

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const modeTabs = $$('.mode-tab');
const filePanel = $('#filePanel');
const textPanel = $('#textPanel');
const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const browseBtn = $('#browseBtn');
const fileList = $('#fileList');
const fileOptions = $('#fileOptions');
const uploadBtn = $('#uploadBtn');
const progressWrapper = $('#progressWrapper');
const progressBar = $('#progressBar');
const textArea = $('#textArea');
const charCount = $('#charCount');
const shareTextBtn = $('#shareTextBtn');
const shareResult = $('#shareResult');
const shareLinkInput = $('#shareLinkInput');
const copyBtn = $('#copyBtn');
const toastContainer = $('#toastContainer');

// ===== State =====
let selectedFiles = [];
let isUploading = false;

// ===== Stats (localStorage-backed) =====
function loadStats() {
  const stats = JSON.parse(localStorage.getItem('clouddrop_stats') || '{}');
  $('#statUploads').textContent = stats.uploads || 0;
  $('#statTexts').textContent = stats.texts || 0;
  $('#statLinks').textContent = (stats.uploads || 0) + (stats.texts || 0);
}

function incrementStat(key) {
  const stats = JSON.parse(localStorage.getItem('clouddrop_stats') || '{}');
  stats[key] = (stats[key] || 0) + 1;
  localStorage.setItem('clouddrop_stats', JSON.stringify(stats));
  loadStats();
}

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== Mode Tabs =====
modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    modeTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const mode = tab.dataset.mode;
    if (mode === 'file') {
      filePanel.classList.add('active');
      textPanel.classList.remove('active');
    } else {
      textPanel.classList.add('active');
      filePanel.classList.remove('active');
    }
    // Hide share result when switching
    shareResult.classList.remove('active');
  });
});

// ===== File Type Helpers =====
function getFileCategory(file) {
  const type = file.type || '';
  const ext = file.name.split('.').pop().toLowerCase();

  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('text/') || ['js', 'py', 'html', 'css', 'json', 'xml', 'md', 'yml', 'yaml', 'ts', 'jsx', 'tsx'].includes(ext)) return 'text';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt'].includes(ext)) return 'document';
  return 'other';
}

function getFileIcon(category) {
  const icons = { image: '🖼️', video: '🎬', text: '📄', document: '📑', other: '📎' };
  return icons[category] || '📎';
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ===== Drag & Drop =====
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  addFiles(files);
});

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropZone.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  addFiles(files);
  fileInput.value = '';
});

// ===== File Management =====
function addFiles(files) {
  for (const file of files) {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      showToast(`${file.name} is too large (max ${formatSize(CONFIG.MAX_FILE_SIZE)})`, 'error');
      continue;
    }
    // Prevent duplicates
    if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      showToast(`${file.name} already added`, 'info');
      continue;
    }
    selectedFiles.push(file);
  }
  renderFileList();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const cat = getFileCategory(file);
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-item-icon ${cat}">${getFileIcon(cat)}</div>
      <div class="file-item-info">
        <div class="file-item-name">${file.name}</div>
        <div class="file-item-size">${formatSize(file.size)} · ${cat}</div>
      </div>
      <button class="file-item-remove" title="Remove" data-index="${index}">✕</button>
    `;
    fileList.appendChild(item);
  });

  // Bind remove buttons
  fileList.querySelectorAll('.file-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFile(parseInt(btn.dataset.index)));
  });

  // Show/hide options and toggle upload button
  fileOptions.style.display = selectedFiles.length > 0 ? 'flex' : 'none';
  uploadBtn.disabled = selectedFiles.length === 0;
}

// ===== Text Area =====
textArea.addEventListener('input', () => {
  const len = textArea.value.length;
  charCount.textContent = `${len.toLocaleString()} characters`;
  shareTextBtn.disabled = len === 0;
});

// ===== Generate Share Code =====
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ===== Upload Files =====
uploadBtn.addEventListener('click', async () => {
  if (isUploading || selectedFiles.length === 0) return;
  isUploading = true;
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<div class="spinner"></div> Uploading...';
  progressWrapper.classList.add('active');
  progressBar.style.width = '0%';

  const expiry = parseInt($('#fileExpiry').value);

  try {
    const shareCode = generateShareCode();
    const totalFiles = selectedFiles.length;
    let uploaded = 0;

    for (const file of selectedFiles) {
      // Step 1: Request presigned URL from backend
      const response = await fetch(`${CONFIG.API_BASE}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          shareCode: shareCode,
          expiry: expiry
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('API response error:', response.status, errText);
        throw new Error('Failed to get upload URL');
      }
      const data = await response.json();
      console.log('Got presigned URL for:', file.name);

      // Step 2: Upload file directly to S3 via presigned URL
      // NOTE: Do NOT set Content-Type header — it's already signed into the presigned URL
      const uploadResponse = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file
      });

      if (!uploadResponse.ok) {
        const s3ErrText = await uploadResponse.text();
        console.error('S3 upload error:', uploadResponse.status, s3ErrText);
        throw new Error('Failed to upload file to S3');
      }

      uploaded++;
      progressBar.style.width = `${(uploaded / totalFiles) * 100}%`;
    }

    // Success!
    const shareLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}share.html?code=${shareCode}`;
    shareLinkInput.value = shareLink;
    shareResult.classList.add('active');
    incrementStat('uploads');
    showToast('Files uploaded and shared successfully!', 'success');

    // Reset
    selectedFiles = [];
    renderFileList();
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload failed. Make sure the backend is deployed.', 'error');

    // DEMO MODE: Generate a demo link so the UI can still be tested
    const demoCode = generateShareCode();
    const demoLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}share.html?code=${demoCode}`;
    shareLinkInput.value = demoLink;
    shareResult.classList.add('active');

    // Save demo data to localStorage for testing without backend
    const demoFiles = selectedFiles.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      category: getFileCategory(f),
      // For demo: store small files as data URLs
      dataUrl: null
    }));

    // Store first file as data URL if small enough (< 5MB)
    if (selectedFiles.length > 0 && selectedFiles[0].size < 5 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        demoFiles[0].dataUrl = reader.result;
        localStorage.setItem(`clouddrop_${demoCode}`, JSON.stringify({
          type: 'file',
          files: demoFiles,
          expiry: parseInt($('#fileExpiry').value),
          created: Date.now()
        }));
      };
      reader.readAsDataURL(selectedFiles[0]);
    } else {
      localStorage.setItem(`clouddrop_${demoCode}`, JSON.stringify({
        type: 'file',
        files: demoFiles,
        expiry: parseInt($('#fileExpiry').value),
        created: Date.now()
      }));
    }

    incrementStat('uploads');
    selectedFiles = [];
    renderFileList();
  } finally {
    isUploading = false;
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<span>🚀</span> Upload & Share';
    setTimeout(() => {
      progressWrapper.classList.remove('active');
      progressBar.style.width = '0%';
    }, 1000);
  }
});

// ===== Share Text =====
shareTextBtn.addEventListener('click', async () => {
  const text = textArea.value.trim();
  if (!text) return;

  shareTextBtn.disabled = true;
  shareTextBtn.innerHTML = '<div class="spinner"></div> Sharing...';

  const expiry = parseInt($('#textExpiry').value);
  const shareCode = generateShareCode();

  try {
    const response = await fetch(`${CONFIG.API_BASE}/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: text,
        shareCode: shareCode,
        expiry: expiry
      })
    });

    if (!response.ok) throw new Error('Failed to share text');

    const shareLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}share.html?code=${shareCode}`;
    shareLinkInput.value = shareLink;
    shareResult.classList.add('active');
    incrementStat('texts');
    showToast('Text shared successfully!', 'success');
  } catch (err) {
    console.error('Text share error:', err);

    // DEMO MODE: Store in localStorage
    localStorage.setItem(`clouddrop_${shareCode}`, JSON.stringify({
      type: 'text',
      content: text,
      expiry: expiry,
      created: Date.now()
    }));

    const shareLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}share.html?code=${shareCode}`;
    shareLinkInput.value = shareLink;
    shareResult.classList.add('active');
    incrementStat('texts');
    showToast('Text shared (demo mode — backend not connected)', 'info');
  } finally {
    shareTextBtn.disabled = false;
    shareTextBtn.innerHTML = '<span>🔗</span> Share Text';
  }
});

// ===== Copy to Clipboard =====
copyBtn.addEventListener('click', () => {
  shareLinkInput.select();
  navigator.clipboard.writeText(shareLinkInput.value).then(() => {
    copyBtn.textContent = '✅ Copied!';
    copyBtn.classList.add('copied');
    showToast('Link copied to clipboard!', 'success');
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
      copyBtn.classList.remove('copied');
    }, 2000);
  });
});

// ===== Init =====
loadStats();
