/* ═══════════════════════════════════════════════════════════════
   NetDesigner — AI-Powered Design Studio
   Main Application JavaScript
   ═══════════════════════════════════════════════════════════════ */

// ─── STATE ───────────────────────────────────────────────────────
const state = {
  apiKey: localStorage.getItem('nd_api_key') || '',
  model: localStorage.getItem('nd_model') || 'claude-sonnet-4-20250514',
  canvasW: 1200,
  canvasH: 630,
  canvasName: 'Facebook Post',
  projectName: 'Untitled Design',
  elements: [],
  selectedId: null,
  activeTool: 'select',
  zoom: 1,
  history: [],
  historyIndex: -1,
  isDragging: false,
  isResizing: false,
  dragStart: null,
  resizeHandle: null,
  generatedHTML: '',
  savedDesigns: JSON.parse(localStorage.getItem('nd_saved') || '[]'),
  brandColors: JSON.parse(localStorage.getItem('nd_colors') || '[]'),
  assets: JSON.parse(localStorage.getItem('nd_assets') || '[]'),
  nextId: 1,
};

// ─── DOM REFS ────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  splash: $('#splash-screen'),
  apiModal: $('#api-key-modal'),
  apiKeyInput: $('#api-key-input'),
  app: $('#app'),
  canvas: $('#design-canvas'),
  canvasContainer: $('#canvas-container'),
  canvasScroll: $('#canvas-scroll'),
  canvasWrapper: $('#canvas-wrapper'),
  canvasLabel: $('#canvas-size-label'),
  placeholder: $('#canvas-placeholder'),
  layersList: $('#layers-list'),
  savedList: $('#saved-list'),
  zoomLevel: $('#zoom-level'),
  aiPrompt: $('#ai-prompt'),
  aiMode: $('#ai-mode'),
  aiStatus: $('#ai-status'),
  aiStatusText: $('#ai-status-text'),
  propsEmpty: $('#props-empty'),
  propsForm: $('#props-form'),
  propsTitle: $('#props-title'),
  toastContainer: $('#toast-container'),
  projectName: $('#project-name-display'),

  // Assets
  assetsList: $('#assets-image-list'),
  brandColorsList: $('#brand-colors-list'),
  btnUploadImage: $('#btn-upload-image'),
  assetUploadInput: $('#asset-upload-input'),
  btnAddColor: $('#btn-add-color'),
  hiddenColorPicker: $('#hidden-color-picker'),
};

// ─── INITIALIZATION ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Splash screen
  setTimeout(() => {
    dom.splash.classList.add('hidden');
    setTimeout(() => {
      dom.splash.style.display = 'none';
      if (!state.apiKey) {
        dom.apiModal.style.display = 'flex';
      } else {
        showApp();
      }
    }, 600);
  }, 2200);

  bindEvents();
  renderSavedDesigns();
  renderBrandColors();
  renderAssets();
}

function showApp() {
  dom.app.style.display = 'flex';
  dom.app.style.animation = 'fadeIn 0.4s ease';
}

// ─── EVENT BINDINGS ──────────────────────────────────────────────
function bindEvents() {
  // API Key Modal
  $('#save-api-key').addEventListener('click', saveApiKey);
  $('#skip-api-key').addEventListener('click', () => {
    dom.apiModal.style.display = 'none';
    showApp();
  });
  $('#toggle-key-vis').addEventListener('click', () => toggleInputVis(dom.apiKeyInput));

  // Settings Modal
  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings-save').addEventListener('click', saveSettings);
  $('#settings-cancel').addEventListener('click', () => { $('#settings-modal').style.display = 'none'; });
  $('#toggle-settings-key-vis').addEventListener('click', () => toggleInputVis($('#settings-api-key')));

  // Tool buttons
  $$('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
  });

  // Size cards
  $$('.size-card').forEach(card => {
    card.addEventListener('click', () => {
      setCanvasSize(+card.dataset.w, +card.dataset.h, card.dataset.name);
      $$('.size-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  // Custom size
  $('#btn-custom-size').addEventListener('click', () => {
    const w = +$('#custom-w').value;
    const h = +$('#custom-h').value;
    if (w >= 100 && h >= 100) {
      setCanvasSize(w, h, 'Custom');
      $$('.size-card').forEach(c => c.classList.remove('active'));
    }
  });

  // Panel tabs
  $$('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
  });

  // Zoom
  $('#btn-zoom-in').addEventListener('click', () => setZoom(state.zoom + 0.1));
  $('#btn-zoom-out').addEventListener('click', () => setZoom(state.zoom - 0.1));

  // Canvas events
  dom.canvas.addEventListener('mousedown', onCanvasMouseDown);
  document.addEventListener('mousemove', onCanvasMouseMove);
  document.addEventListener('mouseup', onCanvasMouseUp);
  dom.canvas.addEventListener('dblclick', onCanvasDblClick);

  // Canvas wheel zoom
  dom.canvasWrapper.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(state.zoom + delta);
    }
  }, { passive: false });

  // AI bar
  $('#ai-send').addEventListener('click', sendAIPrompt);
  dom.aiPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAIPrompt();
    }
  });

  // Auto-resize textarea
  dom.aiPrompt.addEventListener('input', () => {
    dom.aiPrompt.style.height = 'auto';
    dom.aiPrompt.style.height = Math.min(dom.aiPrompt.scrollHeight, 120) + 'px';
  });

  // Brand kit controls
  dom.btnAddColor.addEventListener('click', () => dom.hiddenColorPicker.click());
  dom.hiddenColorPicker.addEventListener('input', (e) => addBrandColor(e.target.value));
  dom.btnUploadImage.addEventListener('click', () => dom.assetUploadInput.click());
  dom.assetUploadInput.addEventListener('change', handleAssetUpload);

  // Undo/Redo
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);

  // Save & Export
  $('#btn-save').addEventListener('click', saveDesign);
  $('#btn-export').addEventListener('click', () => { $('#export-modal').style.display = 'flex'; });
  $('#export-cancel').addEventListener('click', () => { $('#export-modal').style.display = 'none'; });

  // Export formats
  $$('.export-option').forEach(opt => {
    opt.addEventListener('click', () => exportDesign(opt.dataset.format));
  });

  // Properties
  bindPropertyInputs();

  // Delete / Duplicate
  $('#prop-delete').addEventListener('click', deleteSelected);
  $('#prop-duplicate').addEventListener('click', duplicateSelected);

  // Keyboard shortcuts
  document.addEventListener('keydown', onKeyDown);

  // Right click context menu
  dom.canvas.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('click', () => {
    const cm = $('.context-menu');
    if (cm) cm.remove();
  });
}

// ─── API KEY ──────────────────────────────────────────────────────
function saveApiKey() {
  const key = dom.apiKeyInput.value.trim();
  if (!key) {
    showToast('Please enter a valid API key', 'error');
    return;
  }
  state.apiKey = key;
  localStorage.setItem('nd_api_key', key);
  dom.apiModal.style.display = 'none';
  showApp();
  showToast('API key saved successfully!', 'success');
}

function toggleInputVis(input) {
  input.type = input.type === 'password' ? 'text' : 'password';
}

function addBrandColor(color) {
  if (!color) return;
  const normalized = color.toUpperCase();
  if (state.brandColors.includes(normalized)) {
    showToast('That brand color is already added', 'info');
    return;
  }
  state.brandColors.push(normalized);
  localStorage.setItem('nd_colors', JSON.stringify(state.brandColors));
  renderBrandColors();
}

function removeBrandColor(color) {
  state.brandColors = state.brandColors.filter(c => c !== color);
  localStorage.setItem('nd_colors', JSON.stringify(state.brandColors));
  renderBrandColors();
}

function renderBrandColors() {
  if (!dom.brandColorsList) return;

  if (state.brandColors.length === 0) {
    dom.brandColorsList.innerHTML = '<span class="asset-empty-text">No brand colors yet</span>';
    return;
  }

  dom.brandColorsList.innerHTML = state.brandColors.map(color => `
    <div class="color-item" style="background:${color};" title="${color}">
      <button class="delete-btn" data-color="${color}" title="Remove color">×</button>
    </div>
  `).join('');

  dom.brandColorsList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBrandColor(btn.dataset.color);
    });
  });
}

function handleAssetUpload(e) {
  const files = [...(e.target.files || [])];
  if (!files.length) return;

  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.assets.push({
        id: 'asset-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result,
      });
      localStorage.setItem('nd_assets', JSON.stringify(state.assets));
      renderAssets();
    };
    reader.readAsDataURL(file);
  });

  e.target.value = '';
}

function removeAsset(id) {
  state.assets = state.assets.filter(a => a.id !== id);
  localStorage.setItem('nd_assets', JSON.stringify(state.assets));
  renderAssets();
}

function addAssetToCanvas(id) {
  const asset = state.assets.find(a => a.id === id);
  if (!asset) return;
  createElement('image', {
    w: 220,
    h: 220,
    fill: 'transparent',
    imageSrc: asset.dataUrl,
    name: asset.name,
  });
  showToast('Image added to canvas', 'success');
}

function renderAssets() {
  if (!dom.assetsList) return;

  if (state.assets.length === 0) {
    dom.assetsList.innerHTML = '<span class="asset-empty-text">No images uploaded yet</span>';
    return;
  }

  dom.assetsList.innerHTML = state.assets.map(asset => `
    <div class="asset-item">
      <div class="asset-preview" style="background-image:url('${asset.dataUrl}')"></div>
      <div class="asset-info">
        <span class="asset-name">${escapeHTML(asset.name)}</span>
      </div>
      <div class="asset-actions">
        <button class="asset-btn" data-action="use" data-id="${asset.id}" title="Add to canvas">+</button>
        <button class="asset-btn" data-action="delete" data-id="${asset.id}" title="Delete">×</button>
      </div>
    </div>
  `).join('');

  dom.assetsList.querySelectorAll('.asset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'use') addAssetToCanvas(btn.dataset.id);
      if (btn.dataset.action === 'delete') removeAsset(btn.dataset.id);
    });
  });
}

// ─── SETTINGS ─────────────────────────────────────────────────────
function openSettings() {
  $('#settings-api-key').value = state.apiKey;
  $('#settings-model').value = state.model;
  $('#settings-modal').style.display = 'flex';
}

function saveSettings() {
  const key = $('#settings-api-key').value.trim();
  if (key) {
    state.apiKey = key;
    localStorage.setItem('nd_api_key', key);
  }
  state.model = $('#settings-model').value;
  localStorage.setItem('nd_model', state.model);
  $('#settings-modal').style.display = 'none';
  showToast('Settings saved!', 'success');
}

// ─── CANVAS SIZE ──────────────────────────────────────────────────
function setCanvasSize(w, h, name) {
  state.canvasW = w;
  state.canvasH = h;
  state.canvasName = name;
  dom.canvas.style.width = w + 'px';
  dom.canvas.style.height = h + 'px';
  dom.canvasLabel.textContent = `${w} × ${h} — ${name}`;
  // Auto-fit zoom
  autoFitZoom();
}

function autoFitZoom() {
  const wrapper = dom.canvasWrapper;
  const availW = wrapper.clientWidth - 120;
  const availH = wrapper.clientHeight - 120;
  const fitZoom = Math.min(availW / state.canvasW, availH / state.canvasH, 1);
  setZoom(Math.max(0.1, Math.min(fitZoom, 2)));
}

// ─── ZOOM ─────────────────────────────────────────────────────────
function setZoom(z) {
  state.zoom = Math.max(0.1, Math.min(z, 3));
  dom.canvasContainer.style.transform = `scale(${state.zoom})`;
  dom.zoomLevel.textContent = Math.round(state.zoom * 100) + '%';
}

// ─── TOOLS ────────────────────────────────────────────────────────
function setActiveTool(tool) {
  state.activeTool = tool;
  $$('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));

  if (tool === 'hand') {
    dom.canvas.style.cursor = 'grab';
  } else if (tool === 'select') {
    dom.canvas.style.cursor = 'default';
  } else {
    dom.canvas.style.cursor = 'crosshair';
  }
}

// ─── PANEL SWITCHING ──────────────────────────────────────────────
function switchPanel(panel) {
  $$('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === panel));
  $('#panel-sizes').style.display = panel === 'sizes' ? 'block' : 'none';
  $('#panel-layers').style.display = panel === 'layers' ? 'block' : 'none';
  $('#panel-assets').style.display = panel === 'assets' ? 'block' : 'none';
  $('#panel-saved').style.display = panel === 'saved' ? 'block' : 'none';
}

// ─── TOAST ────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

// ═══════════════════════════════════════════════════════════════════
// ELEMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

function createElement(type, props = {}) {
  const id = 'el-' + state.nextId++;
  const el = {
    id,
    type, // 'rect' | 'circle' | 'text' | 'line' | 'html' | 'image'
    x: props.x ?? 50,
    y: props.y ?? 50,
    w: props.w ?? (type === 'text' ? 200 : type === 'line' ? 200 : 150),
    h: props.h ?? (type === 'text' ? 40 : type === 'line' ? 4 : 150),
    fill: props.fill ?? (type === 'text' ? 'transparent' : '#6366F1'),
    borderColor: props.borderColor ?? 'transparent',
    borderWidth: props.borderWidth ?? 0,
    borderRadius: props.borderRadius ?? (type === 'circle' ? 9999 : 0),
    opacity: props.opacity ?? 1,
    rotation: props.rotation ?? 0,
    text: props.text ?? (type === 'text' ? 'Text' : ''),
    fontFamily: props.fontFamily ?? 'Inter',
    fontSize: props.fontSize ?? 24,
    fontWeight: props.fontWeight ?? '600',
    textColor: props.textColor ?? '#000000',
    visible: true,
    locked: false,
    name: props.name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} ${state.nextId - 1}`,
    zIndex: state.elements.length,
    clipPath: props.clipPath ?? '',
    htmlContent: props.htmlContent ?? '',
    imageSrc: props.imageSrc ?? '',
  };

  state.elements.push(el);
  pushHistory();
  renderElement(el);
  renderLayers();
  selectElement(id);
  hidePlaceholder();
  return el;
}

function renderElement(el) {
  // Remove old
  const old = document.getElementById(el.id);
  if (old) old.remove();

  const div = document.createElement('div');
  div.id = el.id;
  div.className = 'design-element';
  div.dataset.elId = el.id;

  // Position & size
  Object.assign(div.style, {
    left: el.x + 'px',
    top: el.y + 'px',
    width: el.w + 'px',
    height: el.h + 'px',
    backgroundColor: el.type === 'text' && el.fill === 'transparent' ? 'transparent' : el.fill,
    borderRadius: el.borderRadius + 'px',
    border: el.borderWidth > 0 ? `${el.borderWidth}px solid ${el.borderColor}` : 'none',
    opacity: el.opacity,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : '',
    zIndex: el.zIndex,
    display: el.visible ? 'block' : 'none',
    clipPath: el.clipPath || '',
    overflow: 'hidden',
  });

  // Text content
  if (el.type === 'text') {
    div.innerHTML = `<span style="
      font-family: '${el.fontFamily}', sans-serif;
      font-size: ${el.fontSize}px;
      font-weight: ${el.fontWeight};
      color: ${el.textColor};
      display: block;
      width: 100%;
      height: 100%;
      white-space: pre-wrap;
      word-break: break-word;
      padding: 4px;
      line-height: 1.3;
    ">${escapeHTML(el.text)}</span>`;
  }

  if (el.type === 'html') {
    div.innerHTML = el.htmlContent;
    // Background and visual styles are on the inner wrapper div
    div.style.backgroundColor = 'transparent';
    div.style.border = 'none';
  }

  if (el.type === 'image') {
    div.style.backgroundImage = `url('${el.imageSrc}')`;
    div.style.backgroundSize = 'cover';
    div.style.backgroundPosition = 'center';
    div.style.backgroundColor = '#E2E8F0';
  }

  // Circle specific
  if (el.type === 'circle') {
    div.style.borderRadius = '50%';
  }

  // Line 
  if (el.type === 'line') {
    div.style.height = Math.max(el.h, 2) + 'px';
  }

  dom.canvas.appendChild(div);

  // Selected state
  if (state.selectedId === el.id) {
    div.classList.add('selected');
    addResizeHandles(div);
  }
}

function addResizeHandles(div) {
  const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
  handles.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    handle.dataset.handle = pos;
    div.appendChild(handle);
  });
}

function renderAllElements() {
  // Remove all design elements from canvas
  dom.canvas.querySelectorAll('.design-element').forEach(el => el.remove());
  state.elements.forEach(el => renderElement(el));
}


function hidePlaceholder() {
  if (state.elements.length > 0 || state.generatedHTML) {
    dom.placeholder.style.display = 'none';
  } else {
    dom.placeholder.style.display = 'flex';
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── SELECTION ────────────────────────────────────────────────────
function selectElement(id) {
  state.selectedId = id;

  // Update canvas visuals
  dom.canvas.querySelectorAll('.design-element').forEach(el => {
    el.classList.remove('selected');
    el.querySelectorAll('.resize-handle').forEach(h => h.remove());
  });

  if (id) {
    const div = document.getElementById(id);
    if (div) {
      div.classList.add('selected');
      addResizeHandles(div);
    }
    showProperties(id);
  } else {
    hideProperties();
  }

  renderLayers();
}

function deselectAll() {
  selectElement(null);
}

// ─── LAYERS ───────────────────────────────────────────────────────
function renderLayers() {
  if (state.elements.length === 0) {
    dom.layersList.innerHTML = `
      <div class="layers-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        <p>No elements yet</p>
        <span>Generate a design or add elements manually</span>
      </div>`;
    return;
  }

  const items = [...state.elements].reverse().map(el => {
    const typeIcons = {
      rect: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
      circle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
      text: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
      line: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>',
      html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    };

    const visIcon = el.visible
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    return `<div class="layer-item ${state.selectedId === el.id ? 'selected' : ''}" data-el-id="${el.id}">
      <div class="layer-icon" style="background:${el.fill === 'transparent' ? 'var(--bg-active)' : el.fill}; color: white;">${typeIcons[el.type] || ''}</div>
      <span class="layer-name">${el.name}</span>
      <button class="layer-visibility" data-vis-id="${el.id}">${visIcon}</button>
    </div>`;
  }).join('');

  dom.layersList.innerHTML = items;

  // Bind layer clicks
  dom.layersList.querySelectorAll('.layer-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.layer-visibility')) return;
      selectElement(item.dataset.elId);
    });
  });

  dom.layersList.querySelectorAll('.layer-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = state.elements.find(e => e.id === btn.dataset.visId);
      if (el) {
        el.visible = !el.visible;
        renderElement(el);
        renderLayers();
      }
    });
  });
}

// ─── PROPERTIES PANEL ─────────────────────────────────────────────
function showProperties(id) {
  const el = state.elements.find(e => e.id === id);
  if (!el) return;

  dom.propsEmpty.style.display = 'none';
  dom.propsForm.style.display = 'flex';
  dom.propsTitle.textContent = el.name;

  $('#prop-x').value = Math.round(el.x);
  $('#prop-y').value = Math.round(el.y);
  $('#prop-w').value = Math.round(el.w);
  $('#prop-h').value = Math.round(el.h);
  $('#prop-rotation').value = el.rotation;
  $('#prop-fill').value = el.fill === 'transparent' ? '#ffffff' : el.fill;
  $('#prop-fill-text').value = el.fill;
  $('#prop-border-color').value = el.borderColor === 'transparent' ? '#000000' : el.borderColor;
  $('#prop-border-width').value = el.borderWidth;
  $('#prop-radius').value = el.borderRadius;
  $('#prop-opacity').value = Math.round(el.opacity * 100);
  $('#prop-opacity-val').textContent = Math.round(el.opacity * 100) + '%';

  // Text properties - show for both text and html types
  const showTextProps = el.type === 'text' || el.type === 'html';
  $('#prop-group-text').style.display = showTextProps ? 'block' : 'none';
  if (showTextProps) {
    $('#prop-text-content').value = el.text;
    $('#prop-font-family').value = el.fontFamily;
    $('#prop-font-size').value = el.fontSize;
    $('#prop-font-weight').value = el.fontWeight;
    $('#prop-text-color').value = el.textColor;
  }
}

function hideProperties() {
  dom.propsEmpty.style.display = 'flex';
  dom.propsForm.style.display = 'none';
  dom.propsTitle.textContent = 'Properties';
}

function bindPropertyInputs() {
  const updateProp = (prop, transform) => {
    return (e) => {
      const el = state.elements.find(e => e.id === state.selectedId);
      if (!el) return;
      el[prop] = transform ? transform(e.target.value) : e.target.value;
      renderElement(el);
    };
  };

  $('#prop-x').addEventListener('input', updateProp('x', Number));
  $('#prop-y').addEventListener('input', updateProp('y', Number));
  $('#prop-w').addEventListener('input', updateProp('w', Number));
  $('#prop-h').addEventListener('input', updateProp('h', Number));
  $('#prop-rotation').addEventListener('input', updateProp('rotation', Number));
  $('#prop-fill').addEventListener('input', (e) => {
    const el = state.elements.find(e => e.id === state.selectedId);
    if (!el) return;
    el.fill = e.target.value;
    $('#prop-fill-text').value = e.target.value;
    renderElement(el);
  });
  $('#prop-fill-text').addEventListener('change', (e) => {
    const el = state.elements.find(e => e.id === state.selectedId);
    if (!el) return;
    el.fill = e.target.value;
    if (e.target.value.startsWith('#')) {
      $('#prop-fill').value = e.target.value;
    }
    renderElement(el);
  });
  $('#prop-border-color').addEventListener('input', updateProp('borderColor'));
  $('#prop-border-width').addEventListener('input', updateProp('borderWidth', Number));
  $('#prop-radius').addEventListener('input', updateProp('borderRadius', Number));
  $('#prop-opacity').addEventListener('input', (e) => {
    const el = state.elements.find(e => e.id === state.selectedId);
    if (!el) return;
    el.opacity = +e.target.value / 100;
    $('#prop-opacity-val').textContent = e.target.value + '%';
    renderElement(el);
  });

  // Text props
  $('#prop-text-content').addEventListener('input', updateProp('text'));
  $('#prop-font-family').addEventListener('change', updateProp('fontFamily'));
  $('#prop-font-size').addEventListener('input', updateProp('fontSize', Number));
  $('#prop-font-weight').addEventListener('change', updateProp('fontWeight'));
  $('#prop-text-color').addEventListener('input', updateProp('textColor'));
}

// ─── CANVAS INTERACTIONS ──────────────────────────────────────────

function onCanvasMouseDown(e) {
  const el = e.target.closest('.design-element');
  const handle = e.target.closest('.resize-handle');

  if (handle && state.selectedId) {
    // Start resizing
    state.isResizing = true;
    state.resizeHandle = handle.dataset.handle;
    const selEl = state.elements.find(el => el.id === state.selectedId);
    state.dragStart = {
      x: e.clientX,
      y: e.clientY,
      elX: selEl.x,
      elY: selEl.y,
      elW: selEl.w,
      elH: selEl.h,
    };
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (el) {
    const elId = el.dataset.elId;
    selectElement(elId);

    // Start dragging
    const selEl = state.elements.find(e => e.id === elId);
    if (selEl) {
      state.isDragging = true;
      state.dragStart = {
        x: e.clientX,
        y: e.clientY,
        elX: selEl.x,
        elY: selEl.y,
      };
    }
    e.preventDefault();
    return;
  }

  // Click on canvas background
  if (e.target === dom.canvas || e.target === dom.placeholder) {
    if (state.activeTool === 'select' || state.activeTool === 'hand') {
      deselectAll();
      return;
    }

    // Create new element at click position
    const rect = dom.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom;
    const y = (e.clientY - rect.top) / state.zoom;

    if (state.activeTool === 'rect') {
      createElement('rect', { x, y, w: 150, h: 100, fill: '#6366F1' });
    } else if (state.activeTool === 'circle') {
      createElement('circle', { x, y, w: 120, h: 120, fill: '#8B5CF6' });
    } else if (state.activeTool === 'text') {
      createElement('text', { x, y, w: 200, h: 40, text: 'New Text', fill: 'transparent' });
    } else if (state.activeTool === 'line') {
      createElement('line', { x, y, w: 200, h: 4, fill: '#374151' });
    }
  }
}

function onCanvasMouseMove(e) {
  if (state.isDragging && state.dragStart && state.selectedId) {
    const dx = (e.clientX - state.dragStart.x) / state.zoom;
    const dy = (e.clientY - state.dragStart.y) / state.zoom;
    const el = state.elements.find(e => e.id === state.selectedId);
    if (el) {
      el.x = state.dragStart.elX + dx;
      el.y = state.dragStart.elY + dy;
      const div = document.getElementById(el.id);
      if (div) {
        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';
      }
    }
  }

  if (state.isResizing && state.dragStart && state.selectedId) {
    const dx = (e.clientX - state.dragStart.x) / state.zoom;
    const dy = (e.clientY - state.dragStart.y) / state.zoom;
    const el = state.elements.find(e => e.id === state.selectedId);
    if (!el) return;

    const h = state.resizeHandle;
    if (h.includes('e')) el.w = Math.max(20, state.dragStart.elW + dx);
    if (h.includes('s')) el.h = Math.max(20, state.dragStart.elH + dy);
    if (h.includes('w')) {
      el.w = Math.max(20, state.dragStart.elW - dx);
      el.x = state.dragStart.elX + dx;
    }
    if (h.includes('n')) {
      el.h = Math.max(20, state.dragStart.elH - dy);
      el.y = state.dragStart.elY + dy;
    }

    const div = document.getElementById(el.id);
    if (div) {
      div.style.left = el.x + 'px';
      div.style.top = el.y + 'px';
      div.style.width = el.w + 'px';
      div.style.height = el.h + 'px';
    }
  }
}

function onCanvasMouseUp(e) {
  if (state.isDragging || state.isResizing) {
    if (state.selectedId) {
      showProperties(state.selectedId);
      pushHistory();
    }
  }
  state.isDragging = false;
  state.isResizing = false;
  state.dragStart = null;
  state.resizeHandle = null;
}

function onCanvasDblClick(e) {
  const elDiv = e.target.closest('.design-element');
  if (!elDiv) return;
  const el = state.elements.find(e => e.id === elDiv.dataset.elId);
  if (!el) return;

  const enableInlineEditing = (targetEl, onSave) => {
    if (!targetEl || !targetEl.textContent.trim()) return;

    targetEl.contentEditable = true;
    targetEl.spellcheck = false;
    targetEl.style.cursor = 'text';
    targetEl.focus();

    const range = document.createRange();
    range.selectNodeContents(targetEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    targetEl.addEventListener('blur', () => {
      targetEl.contentEditable = false;
      targetEl.style.cursor = '';
      onSave();
      showProperties(el.id);
      pushHistory();
    }, { once: true });
  };

  if (el.type === 'text') {
    const textSpan = elDiv.querySelector('span');
    enableInlineEditing(textSpan, () => {
      el.text = textSpan?.textContent || '';
    });
  } else if (el.type === 'html') {
    const validTags = new Set(['SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'BUTTON', 'LI', 'LABEL', 'STRONG', 'EM', 'B', 'I', 'DIV']);

    const isEditableTextNode = (node) => {
      if (!node || !elDiv.contains(node)) return false;
      if (!validTags.has(node.tagName)) return false;
      if (node.classList.contains('resize-handle') || node.classList.contains('design-element')) return false;
      if (!node.textContent.trim()) return false;
      if (node.tagName === 'DIV' && node.children.length > 0) return false;
      return true;
    };

    let textEl = e.target;
    while (textEl && textEl !== elDiv && !isEditableTextNode(textEl)) {
      textEl = textEl.parentElement;
    }

    if (!isEditableTextNode(textEl)) {
      textEl = Array.from(elDiv.querySelectorAll('span, p, h1, h2, h3, h4, h5, h6, a, button, li, label, strong, em, b, i, div'))
        .find(isEditableTextNode);
    }

    enableInlineEditing(textEl, () => {
      el.text = elDiv.textContent?.trim() || '';
      el.htmlContent = elDiv.innerHTML;
    });
  }
}


// ─── CONTEXT MENU ─────────────────────────────────────────────────
function onContextMenu(e) {
  e.preventDefault();
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  const el = e.target.closest('.design-element');
  const hasSelection = !!el;

  if (hasSelection) selectElement(el.dataset.elId);

  menu.innerHTML = `
    ${hasSelection ? `
      <button class="context-menu-item" data-action="duplicate">
        Duplicate <span class="context-menu-shortcut">Ctrl+D</span>
      </button>
      <button class="context-menu-item" data-action="delete">
        Delete <span class="context-menu-shortcut">Del</span>
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" data-action="bring-front">Bring to Front</button>
      <button class="context-menu-item" data-action="send-back">Send to Back</button>
      <div class="context-menu-divider"></div>
    ` : ''}
    <button class="context-menu-item" data-action="add-rect">Add Rectangle</button>
    <button class="context-menu-item" data-action="add-circle">Add Circle</button>
    <button class="context-menu-item" data-action="add-text">Add Text</button>
  `;

  document.body.appendChild(menu);

  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      const rect = dom.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / state.zoom;
      const y = (e.clientY - rect.top) / state.zoom;

      switch (action) {
        case 'duplicate': duplicateSelected(); break;
        case 'delete': deleteSelected(); break;
        case 'bring-front': bringToFront(); break;
        case 'send-back': sendToBack(); break;
        case 'add-rect': createElement('rect', { x, y }); break;
        case 'add-circle': createElement('circle', { x, y }); break;
        case 'add-text': createElement('text', { x, y }); break;
      }
      menu.remove();
    });
  });
}

// ─── ELEMENT OPERATIONS ───────────────────────────────────────────
function deleteSelected() {
  if (!state.selectedId) return;
  const idx = state.elements.findIndex(e => e.id === state.selectedId);
  if (idx > -1) {
    const div = document.getElementById(state.selectedId);
    if (div) div.remove();
    state.elements.splice(idx, 1);
    state.selectedId = null;
    hideProperties();
    renderLayers();
    hidePlaceholder();
    pushHistory();
  }
}

function duplicateSelected() {
  if (!state.selectedId) return;
  const el = state.elements.find(e => e.id === state.selectedId);
  if (!el) return;

  createElement(el.type, {
    ...el,
    x: el.x + 20,
    y: el.y + 20,
    name: el.name + ' Copy',
  });
}

function bringToFront() {
  if (!state.selectedId) return;
  const el = state.elements.find(e => e.id === state.selectedId);
  if (!el) return;
  const maxZ = Math.max(...state.elements.map(e => e.zIndex));
  el.zIndex = maxZ + 1;
  renderElement(el);
  pushHistory();
}

function sendToBack() {
  if (!state.selectedId) return;
  const el = state.elements.find(e => e.id === state.selectedId);
  if (!el) return;
  const minZ = Math.min(...state.elements.map(e => e.zIndex));
  el.zIndex = minZ - 1;
  renderElement(el);
  pushHistory();
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────────
function onKeyDown(e) {
  // Don't intercept if typing in input
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.target.contentEditable === 'true') return;

  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      deleteSelected();
      break;
    case 'v': case 'V':
      setActiveTool('select');
      break;
    case 't': case 'T':
      setActiveTool('text');
      break;
    case 'r': case 'R':
      setActiveTool('rect');
      break;
    case 'c': case 'C':
      if (!e.ctrlKey && !e.metaKey) setActiveTool('circle');
      break;
    case 'l': case 'L':
      setActiveTool('line');
      break;
    case 'h': case 'H':
      setActiveTool('hand');
      break;
    case 'z': case 'Z':
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); undo(); }
      break;
    case 'y': case 'Y':
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); redo(); }
      break;
    case 'd': case 'D':
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); duplicateSelected(); }
      break;
    case 'Escape':
      deselectAll();
      break;
    case 'ArrowUp':
      nudge(0, e.shiftKey ? -10 : -1);
      e.preventDefault();
      break;
    case 'ArrowDown':
      nudge(0, e.shiftKey ? 10 : 1);
      e.preventDefault();
      break;
    case 'ArrowLeft':
      nudge(e.shiftKey ? -10 : -1, 0);
      e.preventDefault();
      break;
    case 'ArrowRight':
      nudge(e.shiftKey ? 10 : 1, 0);
      e.preventDefault();
      break;
  }
}

function nudge(dx, dy) {
  if (!state.selectedId) return;
  const el = state.elements.find(e => e.id === state.selectedId);
  if (!el) return;
  el.x += dx;
  el.y += dy;
  renderElement(el);
  showProperties(el.id);
}

// ─── HISTORY (UNDO/REDO) ─────────────────────────────────────────
function pushHistory() {
  const snapshot = JSON.stringify(state.elements);
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
}

function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex--;
  restoreHistory();
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  restoreHistory();
}

function restoreHistory() {
  try {
    state.elements = JSON.parse(state.history[state.historyIndex]);
    state.selectedId = null;
    renderAllElements();
    renderLayers();
    hideProperties();
    hidePlaceholder();
  } catch (e) {
    console.error('History restore failed:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// AI INTEGRATION — CLAUDE API
// ═══════════════════════════════════════════════════════════════════

async function sendAIPrompt() {
  const prompt = dom.aiPrompt.value.trim();
  if (!prompt) {
    showToast('Please describe the design you want', 'warning');
    return;
  }

  if (!state.apiKey) {
    showToast('Please set your Claude API key in Settings', 'error');
    openSettings();
    return;
  }

  const mode = dom.aiMode.value;
  const isEditable = document.getElementById('ai-editable')?.checked ?? true;
  dom.aiStatus.style.display = 'flex';
  dom.aiStatusText.textContent = mode === 'generate' ? 'Generating your design...' : 'Adjusting your design...';

  try {
    const systemPrompt = buildSystemPrompt(mode, isEditable);
    const userPrompt = buildUserPrompt(prompt, mode);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: state.model,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API request failed (${response.status})`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Extract HTML from response
    const htmlMatch = content.match(/```html\n?([\s\S]*?)```/) || content.match(/<div[\s\S]*<\/div>/);
    let designHTML = '';

    if (htmlMatch) {
      designHTML = htmlMatch[1] || htmlMatch[0];
    } else {
      // Try to use the entire response as HTML if it looks like HTML
      if (content.includes('<') && content.includes('>')) {
        designHTML = content;
      } else {
        throw new Error('Could not extract design HTML from response');
      }
    }

    applyGeneratedDesign(designHTML, mode, isEditable);
    showToast(mode === 'generate' ? 'Design generated!' : 'Design adjusted!', 'success');
    dom.aiPrompt.value = '';
    dom.aiPrompt.style.height = 'auto';

  } catch (err) {
    console.error('AI Error:', err);
    showToast(`AI Error: ${err.message}`, 'error');
  } finally {
    dom.aiStatus.style.display = 'none';
  }
}

function buildSystemPrompt(mode, isEditable = true) {
  let promptText = `You are an expert web designer generating designs as HTML/CSS. The designs are for a canvas of exactly ${state.canvasW}px × ${state.canvasH}px for a "${state.canvasName}" format.

CRITICAL RULES:
1. Output ONLY the inner HTML that goes inside a container div of the given canvas size. DO NOT include <html>, <head>, <body>, or <style> tags at the top level.
2. ALL styles must be INLINE styles. No <style> blocks or external CSS.
3. Every element must use position: absolute with explicit left, top, width, height in pixels within the ${state.canvasW}×${state.canvasH} canvas.
4. Use modern design: gradients, shadows, rounded corners, clean typography.
5. Import Google Fonts using @import in the first style if needed.
6. Use vibrant, professional color schemes. No boring plain colors.
7. Include geometric shapes, patterns, or decorative elements for visual interest.
8. Make text content relevant and realistic.
9. Wrap the output in a single root <div> with position:relative; width:100%; height:100%; overflow:hidden.
10. The background color/gradient of the design should be on the root div.
11. Every visual element (text, shapes, icons) must be a separate div with position:absolute.
12. If brand image assets are provided, use ONLY those exact image data URLs in <img> tags or CSS backgrounds. If none are provided, avoid external image URLs.`;

  if (isEditable) {
    promptText += `\n13. Keep elements editor-friendly: avoid canvas/svg/pseudo-elements and represent each editable text/shape as its own absolutely-positioned div.`;
  } else {
    promptText += `\n13. The design does NOT need to be editor-friendly. Since you do not need to separate elements for editing, you can use SVGs, canvas, complex masking, or anything else you'd like. The output will be treated as a single flat visual element.`;
  }

  promptText += `\n\nReturn ONLY the HTML wrapped in a \`\`\`html code block. No other text.`;
  return promptText;
}

function buildBrandKitPrompt() {
  const colorsText = state.brandColors.length
    ? `Preferred brand colors: ${state.brandColors.join(', ')}`
    : 'Preferred brand colors: none provided.';

  const imageAssets = state.assets.slice(0, 3).map((asset, i) => {
    const shortenedDataUrl = String(asset.dataUrl).slice(0, 12000);
    return `${i + 1}. ${asset.name} (data URL, may be truncated): ${shortenedDataUrl}`;
  });

  const assetsText = imageAssets.length
    ? `Brand images/logos to use in the design:
${imageAssets.join('\n')}`
    : 'Brand images/logos: none provided.';

  return `${colorsText}\n${assetsText}`;
}

function buildUserPrompt(prompt, mode) {
  const brandKitContext = buildBrandKitPrompt();
  if (mode === 'adjust') {
    const currentHTML = serializeCanvasForAI();
    return `Here is the current design HTML:

\`\`\`html
${currentHTML}
\`\`\`

Please adjust the design based on this request: "${prompt}"

Brand kit context:
${brandKitContext}

Keep all existing elements that weren't mentioned, and modify or add elements as requested. Return the COMPLETE updated design HTML.`;
  }

  return `Create a ${state.canvasName} design (${state.canvasW}×${state.canvasH}px) based on this description:

"${prompt}"

Brand kit context:
${brandKitContext}

Generate a complete, visually stunning design with all elements positioned absolutely within the canvas.`;
}

function serializeCanvasForAI() {
  const content = state.elements
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((el) => {
      const baseStyles = [
        'position:absolute',
        `left:${Math.round(el.x)}px`,
        `top:${Math.round(el.y)}px`,
        `width:${Math.round(el.w)}px`,
        `height:${Math.round(el.h)}px`,
        `opacity:${el.opacity}`,
        `z-index:${el.zIndex}`,
      ];

      if (el.rotation) baseStyles.push(`transform:rotate(${el.rotation}deg)`);
      if (el.clipPath) baseStyles.push(`clip-path:${el.clipPath}`);

      if (el.type === 'text') {
        baseStyles.push('background:transparent');
        return `<div style="${baseStyles.join(';')}"><span style="font-family:'${el.fontFamily}',sans-serif;font-size:${el.fontSize}px;font-weight:${el.fontWeight};color:${el.textColor};display:block;width:100%;height:100%;white-space:pre-wrap;word-break:break-word;line-height:1.3">${escapeHTML(el.text)}</span></div>`;
      }

      if (el.type === 'image') {
        baseStyles.push(`background-image:url('${el.imageSrc}')`, 'background-size:cover', 'background-position:center');
      } else {
        baseStyles.push(`background:${el.fill}`);
      }

      if (el.type === 'circle') {
        baseStyles.push('border-radius:50%');
      } else if (el.borderRadius) {
        baseStyles.push(`border-radius:${el.borderRadius}px`);
      }

      if (el.borderWidth > 0) {
        baseStyles.push(`border:${el.borderWidth}px solid ${el.borderColor}`);
      }

      if (el.type === 'html') {
        return `<div style="${baseStyles.join(';')}">${el.htmlContent}</div>`;
      }

      return `<div style="${baseStyles.join(';')}"></div>`;
    })
    .join('');

  return `<div style="position:relative;width:100%;height:100%;overflow:hidden">${content}</div>`;
}

function applyGeneratedDesign(html, mode, isEditable = true) {
  // Clear existing elements if generating new
  if (mode === 'generate') {
    state.elements = [];
    dom.canvas.querySelectorAll('.design-element').forEach(el => el.remove());
  }

  // Remove placeholder
  dom.placeholder.style.display = 'none';

  // Remove previous generated content
  const prevGen = dom.canvas.querySelector('.generated-design');
  if (prevGen) prevGen.remove();

  // Store generated HTML
  state.generatedHTML = html;

  // If not editable, insert as a single flat element
  if (!isEditable) {
    const bgEl = {
      id: 'el-gen-' + state.nextId++,
      type: 'html',
      x: 0,
      y: 0,
      w: state.canvasW,
      h: state.canvasH,
      fill: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      opacity: 1,
      rotation: 0,
      text: '',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '400',
      textColor: '#000000',
      visible: true,
      locked: false,
      name: 'Generated Background / Flat Design',
      zIndex: 0,
      clipPath: '',
      htmlContent: `<div style="position:relative;width:100%;height:100%;">${html}</div>`,
    };
    state.elements.push(bgEl);
    renderElement(bgEl);
    renderLayers();
    hidePlaceholder();
    pushHistory();
    return;
  }

  // Parse off-DOM: create a temporary container to analyze the HTML
  const tempContainer = document.createElement('div');
  tempContainer.style.cssText = `position:relative;width:${state.canvasW}px;height:${state.canvasH}px;`;
  tempContainer.innerHTML = html;

  // Find the root wrapper div (Claude usually outputs one root div)
  const rootDiv = tempContainer.querySelector('div');

  // Extract the background from the root div and apply as a full-canvas background element
  if (rootDiv) {
    const rootStyle = rootDiv.style;
    const bgColor = rootStyle.backgroundColor || rootStyle.background || '';
    const bgGradient = rootStyle.background || '';
    if (bgColor || bgGradient) {
      const bgEl = {
        id: 'el-gen-' + state.nextId++,
        type: 'rect',
        x: 0,
        y: 0,
        w: state.canvasW,
        h: state.canvasH,
        fill: bgGradient || bgColor || '#FFFFFF',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        opacity: parseFloat(rootStyle.opacity) || 1,
        rotation: 0,
        text: '',
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: '400',
        textColor: '#000000',
        visible: true,
        locked: false,
        name: 'Background',
        zIndex: 0,
        clipPath: '',
        htmlContent: '',
      };
      state.elements.push(bgEl);
      renderElement(bgEl);
    }

    // Now parse each absolutely-positioned child inside the root
    parseGeneratedChildren(rootDiv, 1);
  } else {
    // No root div found — try to parse direct children
    parseGeneratedChildren(tempContainer, 1);
  }

  renderLayers();
  hidePlaceholder();
  pushHistory();
}

function parseGeneratedChildren(parent, startZIndex) {
  const children = parent.children;
  let zIdx = startZIndex;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const style = child.style;

    // Keep parser stable: only top-level absolutely-positioned blocks become editable elements.
    // Deep recursion fragments grouped components into scattered pieces.
    if (style.position !== 'absolute') {
      continue;
    }

    // Determine element type
    const hasTextContent = child.textContent?.trim().length > 0;
    const hasChildElements = child.children.length > 0;

    // Simple text: no child elements, just text directly in the div
    const isSimpleText = hasTextContent && !hasChildElements;

    // Text with simple formatting tags (span, p, h1-h6, etc)
    const hasOnlyTextChildren = hasTextContent && hasChildElements &&
      Array.from(child.children).every(c =>
        ['SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'STRONG', 'EM', 'B', 'I', 'BR'].includes(c.tagName)
      );

    // Use 'html' type to preserve Claude's exact styling for complex elements
    // Only use simpler types for truly simple elements
    let type = 'html';
    if (!hasTextContent && !hasChildElements) {
      type = 'rect';
    } else if (isSimpleText) {
      type = 'text';
    }
    // Note: hasOnlyTextChildren still uses 'html' to preserve text-shadows, gradients, etc.

    // Check for circle (simple shapes only)
    const br = parseInt(style.borderRadius) || 0;
    if (type === 'rect' && (br >= 50 || style.borderRadius === '50%')) {
      type = 'circle';
    }

    // Extract text styling from the element or its first text child
    let fontFamily = style.fontFamily?.replace(/['"]+/g, '') || 'Inter';
    let fontSize = parseInt(style.fontSize) || 16;
    let fontWeight = style.fontWeight || '400';
    let textColor = style.color || '#000000';

    // Try to get text style from a child span/p/h tag
    const textChild = child.querySelector('span, p, h1, h2, h3, h4, h5, h6');
    if (textChild) {
      const tcs = textChild.style;
      if (tcs.fontFamily) fontFamily = tcs.fontFamily.replace(/['"]+/g, '');
      if (tcs.fontSize) fontSize = parseInt(tcs.fontSize) || fontSize;
      if (tcs.fontWeight) fontWeight = tcs.fontWeight;
      if (tcs.color) textColor = tcs.color;
    }

    // Parse dimensions — handle px, %, and calc() values
    let w = parseDimension(style.width, state.canvasW) || Math.round(child.getBoundingClientRect().width) || 100;
    let h = parseDimension(style.height, state.canvasH) || Math.round(child.getBoundingClientRect().height) || 100;
    let x = parseFloat(style.left) || 0;
    let y = parseFloat(style.top) || 0;

    // Extract visual styles that should be on the wrapper
    const boxShadow = style.boxShadow || '';
    const background = style.background || style.backgroundColor || 'transparent';

    // For 'html' type, store innerHTML (NOT outerHTML) to avoid double-positioning.
    // The wrapper div from renderElement handles position/size.
    // We also need to copy visual styles that were on the original element.
    let htmlContent = '';
    if (type === 'html') {
      // Preserve Claude output as faithfully as possible while letting the editor wrapper control placement.
      const clone = child.cloneNode(true);
      clone.style.position = 'relative';
      clone.style.left = '0px';
      clone.style.top = '0px';
      clone.style.right = 'auto';
      clone.style.bottom = 'auto';
      clone.style.margin = '0';
      clone.style.width = '100%';
      clone.style.height = '100%';

      htmlContent = clone.outerHTML;
    }

    const el = {
      id: 'el-gen-' + state.nextId++,
      type,
      x,
      y,
      w,
      h,
      fill: type === 'html' ? 'transparent' : background,
      borderColor: style.borderColor || 'transparent',
      borderWidth: parseInt(style.borderWidth) || 0,
      borderRadius: br,
      opacity: parseFloat(style.opacity) || 1,
      rotation: 0,
      text: child.textContent?.trim() || '',
      fontFamily,
      fontSize,
      fontWeight,
      textColor,
      visible: true,
      locked: false,
      name: hasTextContent ? `Text: ${(child.textContent?.trim() || '').substring(0, 20)}` : `Shape ${zIdx}`,
      zIndex: parseInt(style.zIndex) || zIdx,
      clipPath: style.clipPath || '',
      htmlContent,
    };

    state.elements.push(el);
    renderElement(el);
    zIdx++;
  }
}

// Helper: parse CSS dimension values (px, %, calc)
function parseDimension(value, containerSize) {
  if (!value) return 0;
  if (value.endsWith('px')) return parseInt(value);
  if (value.endsWith('%')) return Math.round((parseFloat(value) / 100) * containerSize);
  return parseInt(value) || 0;
}

// ═══════════════════════════════════════════════════════════════════
// SAVE & LOAD DESIGNS
// ═══════════════════════════════════════════════════════════════════

function saveDesign() {
  const name = state.projectName || 'Untitled Design';
  const design = {
    id: 'design-' + Date.now(),
    name,
    canvasW: state.canvasW,
    canvasH: state.canvasH,
    canvasName: state.canvasName,
    elements: state.elements,
    generatedHTML: state.generatedHTML,
    canvasHTML: dom.canvas.innerHTML,
    savedAt: new Date().toISOString(),
  };

  // Check if overwriting existing
  const existingIdx = state.savedDesigns.findIndex(d => d.name === name);
  if (existingIdx > -1) {
    state.savedDesigns[existingIdx] = design;
  } else {
    state.savedDesigns.push(design);
  }

  localStorage.setItem('nd_saved', JSON.stringify(state.savedDesigns));
  renderSavedDesigns();
  showToast(`Design "${name}" saved!`, 'success');
}

function loadDesign(designId) {
  const design = state.savedDesigns.find(d => d.id === designId);
  if (!design) return;

  state.canvasW = design.canvasW;
  state.canvasH = design.canvasH;
  state.canvasName = design.canvasName;
  state.projectName = design.name;
  state.elements = design.elements || [];
  state.generatedHTML = design.generatedHTML || '';

  dom.canvas.style.width = design.canvasW + 'px';
  dom.canvas.style.height = design.canvasH + 'px';
  dom.canvasLabel.textContent = `${design.canvasW} × ${design.canvasH} — ${design.canvasName}`;
  dom.projectName.textContent = design.name;

  // Restore canvas content
  if (design.canvasHTML) {
    dom.canvas.innerHTML = design.canvasHTML;
    dom.placeholder.style.display = 'none';
  } else {
    renderAllElements();
  }

  renderLayers();
  hidePlaceholder();
  autoFitZoom();
  deselectAll();

  showToast(`Loaded "${design.name}"`, 'info');
}

function deleteSavedDesign(designId) {
  state.savedDesigns = state.savedDesigns.filter(d => d.id !== designId);
  localStorage.setItem('nd_saved', JSON.stringify(state.savedDesigns));
  renderSavedDesigns();
  showToast('Design deleted', 'info');
}

function renderSavedDesigns() {
  if (state.savedDesigns.length === 0) {
    dom.savedList.innerHTML = `
      <div class="layers-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
        <p>No saved designs</p>
        <span>Save your first design to see it here</span>
      </div>`;
    return;
  }

  dom.savedList.innerHTML = state.savedDesigns.map(d => {
    const date = new Date(d.savedAt);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<div class="saved-item" data-design-id="${d.id}">
      <div class="saved-item-preview" style="background: linear-gradient(135deg, var(--accent-subtle), var(--bg-active));"></div>
      <div class="saved-item-info">
        <div class="saved-item-name">${d.name}</div>
        <div class="saved-item-meta">${d.canvasName} · ${dateStr}</div>
      </div>
      <button class="saved-item-delete" data-del-id="${d.id}" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>`;
  }).join('');

  // Bind
  dom.savedList.querySelectorAll('.saved-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.saved-item-delete')) return;
      loadDesign(item.dataset.designId);
    });
  });

  dom.savedList.querySelectorAll('.saved-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSavedDesign(btn.dataset.delId);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

async function exportDesign(format) {
  $('#export-modal').style.display = 'none';

  if (format === 'html') {
    exportAsHTML();
    return;
  }

  if (format === 'png' || format === 'jpg') {
    await exportAsImage(format);
    return;
  }
}

function exportAsHTML() {
  const canvasContent = dom.canvas.innerHTML;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${state.projectName} — ${state.canvasName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #1a1c28;
      font-family: 'Inter', sans-serif;
    }
    .canvas {
      width: ${state.canvasW}px;
      height: ${state.canvasH}px;
      position: relative;
      overflow: hidden;
      background: transparent;
    }
  </style>
</head>
<body>
  <div class="canvas">
    ${canvasContent}
  </div>
</body>
</html>`;

  downloadFile(html, `${state.projectName}.html`, 'text/html');
  showToast('HTML exported!', 'success');
}

async function exportAsImage(format) {
  showToast('Preparing export...', 'info');

  try {
    // Use html2canvas approach — we'll build it manually
    const canvas = document.createElement('canvas');
    canvas.width = state.canvasW;
    canvas.height = state.canvasH;
    const ctx = canvas.getContext('2d');

    // Create an SVG with foreignObject to render HTML
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${state.canvasW}" height="${state.canvasH}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${state.canvasW}px;height:${state.canvasH}px;position:relative;overflow:hidden;background:transparent;">
          ${dom.canvas.innerHTML}
        </div>
      </foreignObject>
    </svg>`;

    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob((blob) => {
        if (blob) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${state.projectName}.${format}`;
          a.click();
          URL.revokeObjectURL(a.href);
          showToast(`${format.toUpperCase()} exported!`, 'success');
        } else {
          // Fallback: export as HTML
          showToast('Image export not supported, exporting as HTML instead', 'warning');
          exportAsHTML();
        }
      }, mimeType, format === 'jpg' ? 0.92 : undefined);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast('Image export failed. Exporting as HTML instead.', 'warning');
      exportAsHTML();
    };

    img.src = url;
  } catch (err) {
    console.error('Export error:', err);
    showToast('Export failed: ' + err.message, 'error');
  }
}

function downloadFile(content, name, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── PROJECT NAME ─────────────────────────────────────────────────
dom.projectName.addEventListener('click', () => {
  const name = prompt('Enter project name:', state.projectName);
  if (name && name.trim()) {
    state.projectName = name.trim();
    dom.projectName.textContent = state.projectName;
  }
});

// ─── INITIAL HISTORY SNAPSHOT ─────────────────────────────────────
pushHistory();
