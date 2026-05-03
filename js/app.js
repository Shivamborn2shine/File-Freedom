/**
 * CloudDrop — Main Application Logic
 * Handles file upload, text sharing, and UI interactions
 * Powered by Firebase (Firestore)
 */

// ===== Configuration =====
const CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB (Chunks bypass 1MB limit)
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
const shareCodeDisplay = $('#shareCodeDisplay');
const toastContainer = $('#toastContainer');
const retrieveCodeInput = $('#retrieveCodeInput');
const retrieveBtn = $('#retrieveBtn');

// ===== State =====
let selectedFiles = [];
let isUploading = false;

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
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['exe', 'msi', 'apk', 'dmg', 'sh', 'bat'].includes(ext)) return 'executable';
  return 'other';
}

function getFileIcon(category) {
  const icons = { image: '🖼️', video: '🎬', text: '📄', document: '📑', archive: '📦', executable: '⚙️', other: '📎' };
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

// ===== Upload Files to Firebase =====
uploadBtn.addEventListener('click', async () => {
  if (isUploading || selectedFiles.length === 0) return;
  isUploading = true;
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<div class="spinner"></div> Uploading...';
  progressWrapper.classList.add('active');
  progressBar.style.width = '0%';

  // Show playful overlay
  const overlay = $('#processOverlay');
  if (overlay) overlay.classList.add('active');

  try {
    const shareCode = generateShareCode();
    const expiry = parseInt($('#fileExpiry').value);
    const totalFiles = selectedFiles.length;
    let uploaded = 0;
    const filesMetadata = [];

    const batch = db.batch();
    const shareDocRef = db.collection('shares').doc(shareCode);
    const chunksCollectionRef = shareDocRef.collection('chunks');

    await setProcessStep(1, "Reading & Encoding files to Base64...", 800);

    for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex++) {
      const file = selectedFiles[fileIndex];

      // Convert file to Base64 Data URL
      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      if (fileIndex === 0) await setProcessStep(2, "Slicing text into 800KB Chunks...", 800);

      // Split Base64 string into ~800KB chunks to stay under 1MB Firestore limit
      const chunkSize = 800000;
      const chunkIds = [];
      const numChunks = Math.ceil(dataURL.length / chunkSize);

      for (let i = 0; i < numChunks; i++) {
        const chunkStr = dataURL.substring(i * chunkSize, (i + 1) * chunkSize);
        const chunkId = `file_${fileIndex}_chunk_${i}`;
        chunkIds.push(chunkId);
        
        const chunkDocRef = chunksCollectionRef.doc(chunkId);
        batch.set(chunkDocRef, { data: chunkStr, index: i, fileIndex: fileIndex });
      }

      filesMetadata.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        category: getFileCategory(file),
        chunkIds: chunkIds,
        isChunked: true
      });

      uploaded++;
      progressBar.style.width = `${(uploaded / totalFiles) * 100}%`;
      console.log(`Processed: ${file.name} (${numChunks} chunks)`);
    }

    await setProcessStep(3, "Uploading to Firestore Database...", 1200);

    // Add main share metadata to the batch
    batch.set(shareDocRef, {
      type: 'file',
      files: filesMetadata,
      expiry: expiry,
      created: Date.now(),
      shareCode: shareCode
    });

    // Execute all chunk writes and metadata write atomically
    await batch.commit();

    await setProcessStep(4, "Finalizing Share Link...", 600);

    // Hide playful overlay
    if (overlay) {
      const lastStep = $('#step-4');
      if (lastStep) {
        lastStep.classList.remove('active');
        lastStep.classList.add('completed');
      }
      await new Promise(r => setTimeout(r, 400));
      overlay.classList.remove('active');
    }

    // Add the code as a hash fallback in case web servers (like `serve`) drop query parameters on redirect
    const shareLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}share.html?code=${shareCode}#${shareCode}`;
    shareLinkInput.value = shareLink;
    shareCodeDisplay.textContent = shareCode;
    shareResult.classList.add('active');
    incrementStat('uploads');
    showToast('Files uploaded and shared successfully!', 'success');

    // Reset
    selectedFiles = [];
    renderFileList();
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload failed: ' + (err.message || 'Unknown error'), 'error');
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

// ===== Share Text via Firebase =====
shareTextBtn.addEventListener('click', async () => {
  const text = textArea.value.trim();
  if (!text) return;

  shareTextBtn.disabled = true;
  shareTextBtn.innerHTML = '<div class="spinner"></div> Sharing...';

  const expiry = parseInt($('#textExpiry').value);
  const shareCode = generateShareCode();

  try {
    // Save text to Firestore
    await db.collection('shares').doc(shareCode).set({
      type: 'text',
      content: text,
      expiry: expiry,
      created: Date.now(),
      shareCode: shareCode
    });

    // Add the code as a hash fallback in case web servers (like `serve`) drop query parameters on redirect
    const shareLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}share.html?code=${shareCode}#${shareCode}`;
    shareLinkInput.value = shareLink;
    shareCodeDisplay.textContent = shareCode;
    shareResult.classList.add('active');
    incrementStat('texts');
    showToast('Text shared successfully!', 'success');
  } catch (err) {
    console.error('Text share error:', err);
    showToast('Failed to share text: ' + (err.message || 'Unknown error'), 'error');
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

// ===== Init =====
loadStats();
