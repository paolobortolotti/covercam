import { logger } from './logger.js';
import { CameraController } from './camera.js';
import { PALETTE, SceneColorSampler, hexToRgb, wcagContrastRatio } from './color.js';
import { HorizonLevel } from './horizon.js';
import { FORMATS, IMAGE_FILTERS, GRADING_TRIADS, COMPOSITION_GUIDES, LIGHT_BLEND_MODES, resolveFilterCss, computeCropRect, renderCoverOverlay } from './renderer.js';
import { SubjectMaskController } from './subject-mask.js';
import {
  captureDualResolution,
  triggerDownload,
  downloadBoth,
  canShareFiles,
  shareCapture
} from './exporter.js';

const FORMAT_KEYS = ['magazine', 'post', 'story'];
const EDITORIAL_ROLES = {
  kicker: ['Occhiello', 'Es. SPECIALE DESIGN'],
  headline: ['Titolo principale', 'Es. Nuove prospettive'],
  lead: ['Sommario / lead', 'Es. Il racconto che introduce il tema'],
  body: ['Approfondimento', 'Es. Un dettaglio, un dato o una descrizione']
};
const originalEditorialTexts = new Map();

const state = {
  genres: [],
  presets: [],
  currentGenre: 'fashion',
  variantIndex: 0,
  formatId: 'magazine',
  opacity: 1.0,
  editorialLineGap: 1,
  colorMode: 'auto',
  manualColor: '#FFFFFF',
  autoColors: {
    dominantHex: '#222222',
    mastheadHex: '#FFFFFF',
    headlineHex: '#FFFFFF',
    accentHex: null,
    mastheadRatio: 15.0,
    headlineRatio: 15.0
  },
  filterId: 'auto-genre',
  grading: {
    enabled: true,
    triadId: 'glam-vogue',
    c60: '#1C0D18',
    c30: '#F3D1DC',
    c10: '#FF2A6D',
    strength: 0.55,
    blendMode: 'multiply'
  },
  toneAdjust: {
    contrast: 100,
    brightness: 100
  },
  lightSpotMode: false,
  lightSpots: [],
  lightBlendMode: 'multiply',
  activeSpotIndex: -1,
  defaultHaloIntensity: 0.48,
  defaultHaloRadius: 0.34,
  faceCutoutEnabled: false,
  compositionGuide: 'none',
  showSafeZones: false,
  horizon: { enabled: false, angle: 0, isLevel: true },
  mode: 'camera',
  importedImage: null,
  lastCapture: null
};

const dom = {
  appTitleBtn: document.getElementById('appTitleBtn'),
  btnToggleGenresBar: document.getElementById('btnToggleGenresBar'),
  currentGenrePillText: document.getElementById('currentGenrePillText'),
  genreChevron: document.getElementById('genreChevron'),
  btnPrevVariant: document.getElementById('btnPrevVariant'),
  btnNextVariant: document.getElementById('btnNextVariant'),
  btnToggleVariantList: document.getElementById('btnToggleVariantList'),
  variantChevron: document.getElementById('variantChevron'),
  variantPickerRow: document.getElementById('variantPickerRow'),
  presetIndexLabel: document.getElementById('presetIndexLabel'),
  presetNameLabel: document.getElementById('presetNameLabel'),
  btnInstallPwa: document.getElementById('btnInstallPwa'),
  btnExitPhoto: document.getElementById('btnExitPhoto'),
  btnToggleQuickDock: document.getElementById('btnToggleQuickDock'),
  quickDockContainer: document.getElementById('quickDockContainer'),
  dockChevron: document.getElementById('dockChevron'),
  btnGenreLookToggle: document.getElementById('btnGenreLookToggle'),
  dockLookBadge: document.getElementById('dockLookBadge'),
  btnQuickLightHud: document.getElementById('btnQuickLightHud'),
  dockHaloBadge: document.getElementById('dockHaloBadge'),
  btnGuideCycle: document.getElementById('btnGuideCycle'),
  guideShortText: document.getElementById('guideShortText'),
  btnFlipCamera: document.getElementById('btnFlipCamera'),
  btnSettingsToggle: document.getElementById('btnSettingsToggle'),
  dockSettingsBadge: document.getElementById('dockSettingsBadge'),
  genreTabs: document.getElementById('genreTabs'),
  lookGradingPanel: document.getElementById('lookGradingPanel'),
  btnCloseLookSheet: document.getElementById('btnCloseLookSheet'),
  btnToggleGradingEnable: document.getElementById('btnToggleGradingEnable'),
  bar60: document.getElementById('bar60'),
  bar30: document.getElementById('bar30'),
  bar10: document.getElementById('bar10'),
  gradingStrengthSlider: document.getElementById('gradingStrengthSlider'),
  gradingPresetsRow: document.getElementById('gradingPresetsRow'),
  blendModeBar: document.getElementById('blendModeBar'),
  blendModeStatusText: document.getElementById('blendModeStatusText'),
  lightBlendDrawerBar: document.getElementById('lightBlendDrawerBar'),
  color60Input: document.getElementById('color60Input'),
  color30Input: document.getElementById('color30Input'),
  color10Input: document.getElementById('color10Input'),
  color60Hex: document.getElementById('color60Hex'),
  color30Hex: document.getElementById('color30Hex'),
  color10Hex: document.getElementById('color10Hex'),
  contrastToneSlider: document.getElementById('contrastToneSlider'),
  contrastToneValue: document.getElementById('contrastToneValue'),
  brightnessToneSlider: document.getElementById('brightnessToneSlider'),
  brightnessToneValue: document.getElementById('brightnessToneValue'),
  settingsDrawer: document.getElementById('settingsDrawer'),
  editorialFocusFields: document.getElementById('editorialFocusFields'),
  editorialLineGap: document.getElementById('editorialLineGap'),
  editorialLineGapValue: document.getElementById('editorialLineGapValue'),
  btnResetEditorialFocus: document.getElementById('btnResetEditorialFocus'),
  btnCloseSettingsSheet: document.getElementById('btnCloseSettingsSheet'),
  opacitySlider: document.getElementById('opacitySlider'),
  opacityValue: document.getElementById('opacityValue'),
  contrastStatus: document.getElementById('contrastStatus'),
  btnAutoColor: document.getElementById('btnAutoColor'),
  autoSwatchDot: document.getElementById('autoSwatchDot'),
  paletteContainer: document.getElementById('paletteContainer'),
  guideBar: document.getElementById('guideBar'),
  guideStatusText: document.getElementById('guideStatusText'),
  filterBar: document.getElementById('filterBar'),
  filterStatusText: document.getElementById('filterStatusText'),
  lightSpotCountText: document.getElementById('lightSpotCountText'),
  btnLightModeToggle: document.getElementById('btnLightModeToggle'),
  lightModeStatusText: document.getElementById('lightModeStatusText'),
  btnClearLights: document.getElementById('btnClearLights'),
  lightFloatingHud: document.getElementById('lightFloatingHud'),
  btnAddCenterHalo: document.getElementById('btnAddCenterHalo'),
  btnClearLightsHud: document.getElementById('btnClearLightsHud'),
  btnCloseLightHud: document.getElementById('btnCloseLightHud'),
  haloIntensitySlider: document.getElementById('haloIntensitySlider'),
  haloIntensityValue: document.getElementById('haloIntensityValue'),
  haloRadiusSlider: document.getElementById('haloRadiusSlider'),
  haloRadiusValue: document.getElementById('haloRadiusValue'),
  drawerHaloIntensitySlider: document.getElementById('drawerHaloIntensitySlider'),
  drawerHaloIntensityValue: document.getElementById('drawerHaloIntensityValue'),
  drawerHaloRadiusSlider: document.getElementById('drawerHaloRadiusSlider'),
  drawerHaloRadiusValue: document.getElementById('drawerHaloRadiusValue'),
  btnFaceCutoutToggle: document.getElementById('btnFaceCutoutToggle'),
  faceCutoutStatusText: document.getElementById('faceCutoutStatusText'),
  faceSizeSlider: document.getElementById('faceSizeSlider'),
  faceSizeValue: document.getElementById('faceSizeValue'),
  faceFeatherSlider: document.getElementById('faceFeatherSlider'),
  faceFeatherValue: document.getElementById('faceFeatherValue'),
  btnHorizonToggle: document.getElementById('btnHorizonToggle'),
  horizonStatusText: document.getElementById('horizonStatusText'),
  btnSafeZoneToggle: document.getElementById('btnSafeZoneToggle'),
  safeZoneStatusText: document.getElementById('safeZoneStatusText'),
  viewportArea: document.getElementById('viewportArea'),
  stageFrame: document.getElementById('stageFrame'),
  cameraVideo: document.getElementById('cameraVideo'),
  importedPhoto: document.getElementById('importedPhoto'),
  overlayCanvas: document.getElementById('overlayCanvas'),
  swipeHint: document.getElementById('swipeHint'),
  cameraErrorBox: document.getElementById('cameraErrorBox'),
  cameraErrorText: document.getElementById('cameraErrorText'),
  btnRetryCamera: document.getElementById('btnRetryCamera'),
  galleryInput: document.getElementById('galleryInput'),
  btnImportGallery: document.getElementById('btnImportGallery'),
  btnShutter: document.getElementById('btnShutter'),
  btnFormatCycle: document.getElementById('btnFormatCycle'),
  formatRatioText: document.getElementById('formatRatioText'),
  formatNameText: document.getElementById('formatNameText'),
  exportDialog: document.getElementById('exportDialog'),
  exportMetaText: document.getElementById('exportMetaText'),
  previewCoverImg: document.getElementById('previewCoverImg'),
  previewCleanImg: document.getElementById('previewCleanImg'),
  captionCoverName: document.getElementById('captionCoverName'),
  captionCleanName: document.getElementById('captionCleanName'),
  btnDownloadCover: document.getElementById('btnDownloadCover'),
  btnDownloadClean: document.getElementById('btnDownloadClean'),
  btnDownloadBoth: document.getElementById('btnDownloadBoth'),
  btnShareBoth: document.getElementById('btnShareBoth'),
  debugDialog: document.getElementById('debugDialog'),
  debugLogOutput: document.getElementById('debugLogOutput'),
  debugCountText: document.getElementById('debugCountText'),
  btnHardResetCache: document.getElementById('btnHardResetCache'),
  btnCopyLogs: document.getElementById('btnCopyLogs'),
  btnClearLogs: document.getElementById('btnClearLogs')
};

const camera = new CameraController(dom.cameraVideo);
const colorSampler = new SceneColorSampler();
const subjectMask = new SubjectMaskController();
const horizonLevel = new HorizonLevel((hState) => {
  state.horizon = hState;
  scheduleOverlayRedraw();
});

let rafPending = false;

function getGenrePresets() {
  return state.presets.filter(p => p.genre === state.currentGenre);
}

function getCurrentPreset() {
  const list = getGenrePresets();
  if (!list.length) return null;
  const idx = ((state.variantIndex % list.length) + list.length) % list.length;
  return list[idx];
}

function updateStageDimensions() {
  const areaRect = dom.viewportArea.getBoundingClientRect();
  const availW = Math.max(100, areaRect.width - 12);
  const availH = Math.max(100, areaRect.height - 12);
  const format = FORMATS[state.formatId] || FORMATS.magazine;
  const targetRatio = format.ratio;

  let stageW = availW;
  let stageH = stageW / targetRatio;

  if (stageH > availH) {
    stageH = availH;
    stageW = stageH * targetRatio;
  }

  dom.stageFrame.style.width = `${Math.round(stageW)}px`;
  dom.stageFrame.style.height = `${Math.round(stageH)}px`;

  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  dom.overlayCanvas.width = Math.round(stageW * dpr);
  dom.overlayCanvas.height = Math.round(stageH * dpr);

  scheduleOverlayRedraw();
}

function scheduleOverlayRedraw() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    drawPreviewOverlay();
  });
}

function drawPreviewOverlay() {
  const canvas = dom.overlayCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const preset = getCurrentPreset();
  if (!preset) return;

  renderCoverOverlay(ctx, canvas.width, canvas.height, preset, {
    formatId: state.formatId,
    editorialLineGap: state.editorialLineGap,
    opacity: state.opacity,
    colorMode: state.colorMode,
    manualColor: state.manualColor,
    autoColors: state.autoColors,
    showSafeZones: state.showSafeZones,
    horizon: state.horizon,
    lightSpots: state.lightSpots,
    lightBlendMode: state.lightBlendMode,
    faceCutout: {
      enabled: state.faceCutoutEnabled,
      zone: subjectMask.maskZone
    },
    grading: state.grading,
    compositionGuide: state.compositionGuide,
    isExport: false
  });
}

function applyVideoFilter() {
  const f = IMAGE_FILTERS.find(item => item.id === state.filterId) || IMAGE_FILTERS[0];
  const resolvedCss = resolveFilterCss(state.filterId, state.currentGenre, state.toneAdjust);
  const cssVal = resolvedCss === 'none' ? '' : resolvedCss;
  dom.cameraVideo.style.filter = cssVal;
  dom.importedPhoto.style.filter = cssVal;
  if (dom.filterStatusText) {
    dom.filterStatusText.textContent = f.label;
  }
  if (dom.btnGenreLookToggle) {
    const isPanelOpen = dom.lookGradingPanel && !dom.lookGradingPanel.classList.contains('hidden');
    dom.btnGenreLookToggle.setAttribute('aria-pressed', String(isPanelOpen || state.grading.enabled));
  }
  for (const btn of dom.filterBar.querySelectorAll('.chip-btn')) {
    btn.classList.toggle('active', btn.dataset.filter === state.filterId);
  }
  scheduleOverlayRedraw();
}

function updateGradingUI() {
  if (!dom.lookGradingPanel) return;
  const { c60, c30, c10, triadId } = state.grading;
  dom.color60Input.value = c60;
  dom.color30Input.value = c30;
  dom.color10Input.value = c10;
  dom.color60Hex.textContent = c60.toUpperCase();
  dom.color30Hex.textContent = c30.toUpperCase();
  dom.color10Hex.textContent = c10.toUpperCase();

  dom.bar60.style.backgroundColor = c60;
  dom.bar30.style.backgroundColor = c30;
  dom.bar10.style.backgroundColor = c10;

  for (const chip of dom.gradingPresetsRow.querySelectorAll('.triad-chip')) {
    chip.classList.toggle('active', chip.dataset.triad === triadId);
  }
}

function applyGenreDefaultTriad(genreId) {
  const match = GRADING_TRIADS.find(t => t.genre === genreId) || GRADING_TRIADS[0];
  if (!match) return;
  state.grading.triadId = match.id;
  state.grading.c60 = match.c60;
  state.grading.c30 = match.c30;
  state.grading.c10 = match.c10;
  updateGradingUI();
}

function renderGradingPresets() {
  if (!dom.gradingPresetsRow) return;
  dom.gradingPresetsRow.innerHTML = '';
  for (const t of GRADING_TRIADS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `triad-chip${t.id === state.grading.triadId ? ' active' : ''}`;
    btn.dataset.triad = t.id;
    btn.innerHTML = `
      <span class="triad-dots">
        <i style="width:60%;background:${t.c60}"></i>
        <i style="width:30%;background:${t.c30}"></i>
        <i style="width:10%;background:${t.c10}"></i>
      </span>
      <span>${t.label}</span>
    `;
    btn.addEventListener('click', () => {
      state.grading.triadId = t.id;
      state.grading.c60 = t.c60;
      state.grading.c30 = t.c30;
      state.grading.c10 = t.c10;
      logger.info('Triade Color Grading 60-30-10 selezionata', {
        id: t.id,
        c60: t.c60,
        c30: t.c30,
        c10: t.c10
      });
      updateGradingUI();
      scheduleOverlayRedraw();
    });
    dom.gradingPresetsRow.appendChild(btn);
  }
}

function setBlendMode(modeId) {
  state.grading.blendMode = modeId;
  state.lightBlendMode = modeId;
  for (const s of state.lightSpots) {
    s.blendMode = modeId;
  }
  const found = LIGHT_BLEND_MODES.find(m => m.id === modeId) || LIGHT_BLEND_MODES[0];
  if (dom.blendModeStatusText) {
    dom.blendModeStatusText.textContent = found.label;
  }
  if (dom.dockLookBadge) {
    const shortBlend = {
      'multiply': 'Mult.',
      'difference': 'Diff.',
      'overlay': 'Over.',
      'soft-light': 'Soft',
      'color-burn': 'Burn',
      'exclusion': 'Excl.'
    };
    dom.dockLookBadge.textContent = state.grading.enabled ? (shortBlend[modeId] || found.label) : 'OFF';
  }
  for (const container of [dom.blendModeBar, dom.lightBlendDrawerBar]) {
    if (!container) continue;
    for (const btn of container.querySelectorAll('.chip-btn')) {
      btn.classList.toggle('active', btn.dataset.blend === modeId);
    }
  }
  logger.info('Metodo di fusione selezionato', { blendMode: modeId });
  scheduleOverlayRedraw();
}

function renderBlendModeBars() {
  for (const container of [dom.blendModeBar, dom.lightBlendDrawerBar]) {
    if (!container) continue;
    container.innerHTML = '';
    for (const m of LIGHT_BLEND_MODES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-btn${m.id === state.lightBlendMode ? ' active' : ''}`;
      btn.dataset.blend = m.id;
      btn.textContent = m.label;
      btn.addEventListener('click', () => setBlendMode(m.id));
      container.appendChild(btn);
    }
  }
}

function updateGuideUI() {
  const g = COMPOSITION_GUIDES.find(item => item.id === state.compositionGuide) || COMPOSITION_GUIDES[0];
  if (dom.guideStatusText) {
    dom.guideStatusText.textContent = g.label;
  }
  if (dom.btnGuideCycle) {
    const active = state.compositionGuide !== 'none';
    dom.btnGuideCycle.setAttribute('aria-pressed', String(active));
    const shortMap = {
      'none': 'OFF',
      'typo-grid': 'Griglia',
      'golden-spiral': 'Aurea',
      'phi-grid': 'Phi',
      'thirds': 'Terzi',
      'diagonals': 'Diag.'
    };
    dom.guideShortText.textContent = shortMap[state.compositionGuide] || 'OFF';
  }
  if (dom.guideBar) {
    for (const btn of dom.guideBar.querySelectorAll('.chip-btn')) {
      btn.classList.toggle('active', btn.dataset.guide === state.compositionGuide);
    }
  }
}

function renderGuideBar() {
  if (!dom.guideBar) return;
  dom.guideBar.innerHTML = '';
  for (const g of COMPOSITION_GUIDES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip-btn${g.id === state.compositionGuide ? ' active' : ''}`;
    btn.dataset.guide = g.id;
    btn.textContent = g.label;
    btn.addEventListener('click', () => {
      state.compositionGuide = g.id;
      logger.info('Guida composizione selezionata', { guide: g.id, label: g.label });
      updateGuideUI();
      scheduleOverlayRedraw();
    });
    dom.guideBar.appendChild(btn);
  }
  updateGuideUI();
}

function renderFilterBar() {
  dom.filterBar.innerHTML = '';
  for (const f of IMAGE_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip-btn${f.id === state.filterId ? ' active' : ''}`;
    btn.dataset.filter = f.id;
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      state.filterId = f.id;
      logger.info('Filtro immagine selezionato', { filter: f.id, label: f.label });
      applyVideoFilter();
    });
    dom.filterBar.appendChild(btn);
  }
}

function renderVariantPickerRow() {
  if (!dom.variantPickerRow) return;
  const list = getGenrePresets();
  const activeIdx = list.length ? ((state.variantIndex % list.length) + list.length) % list.length : 0;
  dom.variantPickerRow.innerHTML = '';

  list.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `variant-chip${idx === activeIdx ? ' active' : ''}`;
    btn.dataset.index = String(idx);
    btn.innerHTML = `<b>${idx + 1}/${list.length}</b><span>${p.name}</span>`;
    btn.addEventListener('click', () => {
      state.variantIndex = idx;
      logger.info('Variante selezionata direttamente dalla barra', {
        presetId: p.id,
        name: p.name,
        index: idx + 1
      });
      dom.swipeHint.classList.add('fade-out');
      updatePresetUI();
    });
    dom.variantPickerRow.appendChild(btn);
  });
}

function renderEditorialFocusFields() {
  if (!dom.editorialFocusFields) return;
  dom.editorialFocusFields.replaceChildren();
  const preset = getCurrentPreset();
  if (!preset) return;
  preset.elements.forEach((el, index) => {
    const config = EDITORIAL_ROLES[el.role];
    if (!config) return;
    const label = document.createElement('label');
    label.className = 'editorial-field';
    const caption = document.createElement('span');
    caption.textContent = config[0];
    const field = document.createElement(el.role === 'headline' || el.role === 'kicker' ? 'input' : 'textarea');
    field.className = 'editorial-input';
    field.setAttribute('aria-label', config[0]);
    field.placeholder = config[1];
    field.value = el.text || '';
    if (field.tagName === 'TEXTAREA') field.rows = 2;
    field.addEventListener('input', () => {
      preset.elements[index].text = field.value;
      scheduleOverlayRedraw();
    });
    label.append(caption, field);
    dom.editorialFocusFields.appendChild(label);
  });
}

function updatePresetUI() {
  const list = getGenrePresets();
  const preset = getCurrentPreset();
  if (!preset) return;

  const idx = ((state.variantIndex % list.length) + list.length) % list.length;
  dom.presetIndexLabel.textContent = `${idx + 1}/${list.length}`;
  dom.presetNameLabel.textContent = preset.name;

  for (const btn of dom.genreTabs.querySelectorAll('.genre-tab')) {
    btn.classList.toggle('active', btn.dataset.genre === state.currentGenre);
  }
  const activeGenreObj = state.genres.find(g => g.id === state.currentGenre);
  if (dom.currentGenrePillText && activeGenreObj) {
    dom.currentGenrePillText.textContent = activeGenreObj.label;
  }

  renderVariantPickerRow();
  renderEditorialFocusFields();

  applyVideoFilter();
  runSceneColorSample();
  scheduleOverlayRedraw();
}

function renderGenreTabs() {
  dom.genreTabs.innerHTML = '';
  for (const g of state.genres) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `genre-tab${g.id === state.currentGenre ? ' active' : ''}`;
    btn.dataset.genre = g.id;
    btn.textContent = g.label;
    btn.addEventListener('click', () => {
      if (state.currentGenre === g.id) return;
      state.currentGenre = g.id;
      state.variantIndex = 0;
      applyGenreDefaultTriad(g.id);
      logger.info('Cambio genere copertina', { genre: g.id });
      if (dom.genreTabs && !dom.genreTabs.classList.contains('hidden')) {
        dom.genreTabs.classList.add('hidden');
        if (dom.btnToggleGenresBar) dom.btnToggleGenresBar.setAttribute('aria-expanded', 'false');
        if (dom.genreChevron) dom.genreChevron.textContent = '▾';
      }
      if (dom.variantPickerRow) {
        dom.variantPickerRow.classList.remove('hidden');
        if (dom.btnToggleVariantList) dom.btnToggleVariantList.setAttribute('aria-expanded', 'true');
        if (dom.variantChevron) dom.variantChevron.textContent = '▴';
      }
      updateStageDimensions();
      updatePresetUI();
    });
    dom.genreTabs.appendChild(btn);
  }
}

function renderPalette() {
  dom.paletteContainer.innerHTML = '';
  for (const item of PALETTE) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn';
    btn.style.backgroundColor = item.hex;
    btn.title = item.label;
    btn.setAttribute('aria-label', item.label);
    btn.dataset.hex = item.hex;
    btn.addEventListener('click', () => {
      state.colorMode = 'manual';
      state.manualColor = item.hex;
      logger.info('Colore testo impostato manualmente', { hex: item.hex, label: item.label });
      updateColorUI();
      scheduleOverlayRedraw();
    });
    dom.paletteContainer.appendChild(btn);
  }
}

function updateColorUI() {
  dom.btnAutoColor.classList.toggle('active', state.colorMode === 'auto');
  dom.autoSwatchDot.style.backgroundColor = state.autoColors.mastheadHex;

  for (const btn of dom.paletteContainer.querySelectorAll('.swatch-btn')) {
    btn.classList.toggle(
      'active',
      state.colorMode === 'manual' && btn.dataset.hex === state.manualColor
    );
  }

  if (state.colorMode === 'auto') {
    dom.contrastStatus.textContent = `AUTO · ${state.autoColors.mastheadRatio}:1 WCAG`;
    if (dom.dockSettingsBadge) dom.dockSettingsBadge.textContent = 'Auto';
  } else {
    const bgRgb = hexToRgb(state.autoColors.dominantHex || '#222222');
    const fgRgb = hexToRgb(state.manualColor);
    const ratio = wcagContrastRatio(bgRgb, fgRgb).toFixed(1);
    dom.contrastStatus.textContent = `MAN · ${ratio}:1 WCAG`;
    if (dom.dockSettingsBadge) dom.dockSettingsBadge.textContent = 'Man.';
  }
}

function getActiveSourceInfo() {
  if (state.mode === 'photo' && state.importedImage) {
    return {
      source: state.importedImage,
      width: state.importedImage.naturalWidth || state.importedImage.width,
      height: state.importedImage.naturalHeight || state.importedImage.height
    };
  }
  return {
    source: dom.cameraVideo,
    width: dom.cameraVideo.videoWidth,
    height: dom.cameraVideo.videoHeight
  };
}

async function runSceneColorSample() {
  const { source, width, height } = getActiveSourceInfo();
  if (!width || !height) return;

  const format = FORMATS[state.formatId] || FORMATS.magazine;
  const crop = computeCropRect(width, height, format.ratio);
  const preset = getCurrentPreset();
  const preferredHex = preset && preset.defaultColor ? preset.defaultColor : '#FFFFFF';
  const presetAccent = preset && preset.accentColor ? preset.accentColor : '#E63946';

  state.autoColors = colorSampler.sampleSource(source, crop, preferredHex, presetAccent);

  if (state.faceCutoutEnabled) {
    await subjectMask.detectSubject(source, crop);
  }

  updateColorUI();
  if (state.colorMode === 'auto' || state.faceCutoutEnabled) {
    scheduleOverlayRedraw();
  }
}

function switchVariant(delta) {
  const list = getGenrePresets();
  if (!list.length) return;
  state.variantIndex = ((state.variantIndex + delta) % list.length + list.length) % list.length;
  const preset = getCurrentPreset();
  logger.info('Cambio variante preset', {
    presetId: preset.id,
    name: preset.name,
    genre: state.currentGenre
  });
  dom.swipeHint.classList.add('fade-out');
  updatePresetUI();
}

function updateLightSpotsUI() {
  const count = state.lightSpots.length;
  if (dom.lightSpotCountText) dom.lightSpotCountText.textContent = `${count} punti`;
  if (dom.dockHaloBadge) {
    dom.dockHaloBadge.textContent = count > 0 ? `${count}` : (state.lightSpotMode ? 'ON' : 'OFF');
  }
  if (dom.btnQuickLightHud) {
    const isHudOpen = dom.lightFloatingHud && !dom.lightFloatingHud.classList.contains('hidden');
    dom.btnQuickLightHud.setAttribute('aria-pressed', String(isHudOpen || state.lightSpotMode || count > 0));
  }
}

function syncHaloSliders(intensity, radius) {
  const intPct = Math.round((intensity !== undefined ? intensity : state.defaultHaloIntensity) * 100);
  const radPct = Math.round((radius !== undefined ? radius : state.defaultHaloRadius) * 100);
  if (dom.haloIntensitySlider) dom.haloIntensitySlider.value = String(intPct);
  if (dom.haloIntensityValue) dom.haloIntensityValue.textContent = `${intPct}%`;
  if (dom.drawerHaloIntensitySlider) dom.drawerHaloIntensitySlider.value = String(intPct);
  if (dom.drawerHaloIntensityValue) dom.drawerHaloIntensityValue.textContent = `${intPct}%`;

  if (dom.haloRadiusSlider) dom.haloRadiusSlider.value = String(radPct);
  if (dom.haloRadiusValue) dom.haloRadiusValue.textContent = `${radPct}%`;
  if (dom.drawerHaloRadiusSlider) dom.drawerHaloRadiusSlider.value = String(radPct);
  if (dom.drawerHaloRadiusValue) dom.drawerHaloRadiusValue.textContent = `${radPct}%`;
}

function setHaloIntensity(pct) {
  const val = Math.max(10, Math.min(100, pct));
  state.defaultHaloIntensity = val / 100;
  if (state.activeSpotIndex >= 0 && state.lightSpots[state.activeSpotIndex]) {
    state.lightSpots[state.activeSpotIndex].intensity = state.defaultHaloIntensity;
  } else {
    for (const s of state.lightSpots) {
      s.intensity = state.defaultHaloIntensity;
    }
  }
  syncHaloSliders(state.defaultHaloIntensity, state.defaultHaloRadius);
  scheduleOverlayRedraw();
}

function setHaloRadius(pct) {
  const val = Math.max(15, Math.min(65, pct));
  state.defaultHaloRadius = val / 100;
  if (state.activeSpotIndex >= 0 && state.lightSpots[state.activeSpotIndex]) {
    state.lightSpots[state.activeSpotIndex].radius = state.defaultHaloRadius;
  } else {
    for (const s of state.lightSpots) {
      s.radius = state.defaultHaloRadius;
    }
  }
  syncHaloSliders(state.defaultHaloIntensity, state.defaultHaloRadius);
  scheduleOverlayRedraw();
}

function toggleLightHud(forceState) {
  if (!dom.lightFloatingHud) return;
  const isHidden = dom.lightFloatingHud.classList.contains('hidden');
  const shouldShow = typeof forceState === 'boolean' ? forceState : isHidden;
  dom.lightFloatingHud.classList.toggle('hidden', !shouldShow);
  if (shouldShow) {
    state.lightSpotMode = true;
    if (state.lightSpots.length === 0) {
      state.lightSpots.push({
        x: 0.5,
        y: 0.42,
        radius: state.defaultHaloRadius,
        intensity: state.defaultHaloIntensity,
        blendMode: state.lightBlendMode
      });
      state.activeSpotIndex = 0;
    }
    syncHaloSliders(state.defaultHaloIntensity, state.defaultHaloRadius);
  }
  if (dom.btnLightModeToggle) {
    dom.btnLightModeToggle.setAttribute('aria-pressed', String(state.lightSpotMode));
    if (dom.lightModeStatusText) dom.lightModeStatusText.textContent = state.lightSpotMode ? 'ON' : 'OFF';
  }
  updateLightSpotsUI();
  scheduleOverlayRedraw();
}

function setupStageInteractions() {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let draggingMask = false;
  let draggingSpotIdx = -1;
  const activePointers = new Map();
  let initialPinchDist = null;
  let initialMaskRx = 0.24;

  dom.stageFrame.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || e.target.closest('.light-floating-hud')) return;
    if (dom.lookGradingPanel && !dom.lookGradingPanel.classList.contains('hidden')) {
      dom.lookGradingPanel.classList.add('hidden');
    }
    if (dom.settingsDrawer && !dom.settingsDrawer.classList.contains('hidden')) {
      dom.settingsDrawer.classList.add('hidden');
      dom.btnSettingsToggle.setAttribute('aria-expanded', 'false');
    }

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2 && state.faceCutoutEnabled) {
      const pts = [...activePointers.values()];
      initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialMaskRx = subjectMask.maskZone.rx;
      tracking = false;
      draggingMask = false;
      draggingSpotIdx = -1;
      return;
    }

    const rect = dom.stageFrame.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (state.lightSpots.length > 0) {
      for (let i = state.lightSpots.length - 1; i >= 0; i--) {
        const spot = state.lightSpots[i];
        const hitDist = Math.hypot(normX - spot.x, normY - spot.y);
        if (hitDist <= Math.max(0.08, (spot.radius || 0.34) * 0.42)) {
          draggingSpotIdx = i;
          state.activeSpotIndex = i;
          syncHaloSliders(spot.intensity, spot.radius);
          tracking = false;
          return;
        }
      }
    }

    if (
      state.faceCutoutEnabled &&
      Math.hypot(normX - subjectMask.maskZone.x, normY - subjectMask.maskZone.y) <= Math.max(subjectMask.maskZone.rx, 0.18)
    ) {
      draggingMask = true;
      tracking = false;
      return;
    }

    startX = e.clientX;
    startY = e.clientY;
    tracking = true;
  });

  dom.stageFrame.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (draggingSpotIdx >= 0 && state.lightSpots[draggingSpotIdx]) {
      const rect = dom.stageFrame.getBoundingClientRect();
      const normX = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height));
      state.lightSpots[draggingSpotIdx].x = normX;
      state.lightSpots[draggingSpotIdx].y = normY;
      scheduleOverlayRedraw();
      return;
    }

    if (activePointers.size === 2 && state.faceCutoutEnabled && initialPinchDist > 10) {
      const pts = [...activePointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = dist / initialPinchDist;
      const nextRx = Math.max(0.10, Math.min(0.50, initialMaskRx * scale));
      subjectMask.setSize(nextRx);
      if (dom.faceSizeSlider) {
        const pct = Math.round(nextRx * 100);
        dom.faceSizeSlider.value = String(pct);
        dom.faceSizeValue.textContent = `${pct}%`;
      }
      scheduleOverlayRedraw();
      return;
    }

    if (draggingMask && state.faceCutoutEnabled) {
      const rect = dom.stageFrame.getBoundingClientRect();
      const normX = Math.max(0.1, Math.min(0.9, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0.06, Math.min(0.7, (e.clientY - rect.top) / rect.height));
      subjectMask.setManualPoint(normX, normY);
      scheduleOverlayRedraw();
    }
  });

  const endPointer = (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      initialPinchDist = null;
    }
    if (draggingSpotIdx >= 0) {
      draggingSpotIdx = -1;
      return;
    }
    if (draggingMask) {
      draggingMask = false;
      return;
    }
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) switchVariant(1);
      else switchVariant(-1);
      return;
    }

    if (Math.hypot(dx, dy) < 12) {
      const rect = dom.stageFrame.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      if (state.lightSpotMode) {
        if (state.lightSpots.length >= 6) {
          state.lightSpots.shift();
        }
        state.lightSpots.push({
          x: normX,
          y: normY,
          radius: state.defaultHaloRadius,
          intensity: state.defaultHaloIntensity,
          blendMode: state.lightBlendMode
        });
        state.activeSpotIndex = state.lightSpots.length - 1;
        logger.info('Alone aggiunto con tocco', {
          x: Number(normX.toFixed(2)),
          y: Number(normY.toFixed(2)),
          blendMode: state.lightBlendMode,
          total: state.lightSpots.length
        });
        updateLightSpotsUI();
        scheduleOverlayRedraw();
      } else if (state.faceCutoutEnabled && normY < 0.65) {
        subjectMask.setManualPoint(normX, normY);
        scheduleOverlayRedraw();
      }
    }
  };

  dom.stageFrame.addEventListener('pointerup', endPointer);
  dom.stageFrame.addEventListener('pointercancel', endPointer);

  window.addEventListener('keydown', (e) => {
    if (dom.exportDialog.open || dom.debugDialog.open) return;
    if (e.key === 'ArrowRight') switchVariant(1);
    if (e.key === 'ArrowLeft') switchVariant(-1);
  });
}

function setupDialogLightDismissFallback() {
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }
  }
}

function setupLongPressDebug() {
  let timer = null;

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  dom.appTitleBtn.addEventListener('pointerdown', () => {
    clear();
    timer = setTimeout(() => {
      openDebugDialog();
    }, 650);
  });

  dom.appTitleBtn.addEventListener('pointerup', clear);
  dom.appTitleBtn.addEventListener('pointerleave', clear);
  dom.appTitleBtn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function refreshDebugLogs() {
  const entries = logger.getAll();
  dom.debugCountText.textContent = `${entries.length} / 500 eventi registrati`;
  dom.debugLogOutput.textContent = logger.formatText() || 'Nessun log registrato.';
  dom.debugLogOutput.scrollTop = dom.debugLogOutput.scrollHeight;
}

function openDebugDialog() {
  logger.info('Apertura pannello debug log');
  refreshDebugLogs();
  dom.debugDialog.showModal();
}

async function initCamera() {
  dom.cameraErrorBox.classList.add('hidden');
  try {
    await camera.start();
    runSceneColorSample();
    scheduleOverlayRedraw();
  } catch (err) {
    dom.cameraErrorText.textContent = `Fotocamera non attiva (${err.message || 'permesso negato'}). Puoi usare "Galleria" in basso a sinistra per caricare una foto.`;
    dom.cameraErrorBox.classList.remove('hidden');
  }
}

async function handleShutter() {
  const { source, width, height } = getActiveSourceInfo();
  if (!width || !height) {
    logger.warn('Scatto ignorato: nessuna sorgente video o foto pronta');
    return;
  }

  dom.btnShutter.disabled = true;
  try {
    const preset = getCurrentPreset();
    const result = await captureDualResolution({
      source,
      sourceWidth: width,
      sourceHeight: height,
      formatId: state.formatId,
      preset,
      renderOptions: {
        editorialLineGap: state.editorialLineGap,
        opacity: state.opacity,
        colorMode: state.colorMode,
        manualColor: state.manualColor,
        autoColors: state.autoColors,
        filterId: state.filterId,
        lightSpots: state.lightSpots,
        lightBlendMode: state.lightBlendMode,
        faceCutout: {
          enabled: state.faceCutoutEnabled,
          zone: subjectMask.maskZone
        },
        grading: state.grading,
        toneAdjust: state.toneAdjust
      }
    });

    if (state.lastCapture) {
      URL.revokeObjectURL(state.lastCapture.cleanUrl);
      URL.revokeObjectURL(state.lastCapture.coverUrl);
    }
    state.lastCapture = result;

    dom.previewCoverImg.src = result.coverUrl;
    dom.previewCleanImg.src = result.cleanUrl;
    dom.captionCoverName.textContent = result.coverFilename;
    dom.captionCleanName.textContent = result.cleanFilename;
    dom.exportMetaText.textContent = `${result.width} × ${result.height} px · Formato ${FORMATS[state.formatId].desc}`;
    dom.btnShareBoth.classList.toggle('hidden', !canShareFiles());

    dom.exportDialog.showModal();
  } catch (err) {
    logger.error('Errore durante lo scatto ed esportazione', err);
  } finally {
    dom.btnShutter.disabled = false;
  }
}

function handleGalleryFile(file) {
  if (!file) return;
  logger.info('Importazione immagine da galleria', {
    name: file.name,
    type: file.type,
    size: file.size
  });

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.importedImage = img;
    state.mode = 'photo';
    dom.importedPhoto.src = url;
    dom.importedPhoto.classList.remove('hidden');
    dom.cameraVideo.classList.add('hidden');
    dom.cameraErrorBox.classList.add('hidden');
    dom.btnExitPhoto.classList.remove('hidden');
    dom.btnFlipCamera.classList.add('hidden');

    logger.info('Immagine galleria caricata', {
      width: img.naturalWidth,
      height: img.naturalHeight
    });

    runSceneColorSample();
    scheduleOverlayRedraw();
  };
  img.onerror = (err) => {
    logger.error('Errore caricamento immagine galleria', err);
  };
  img.src = url;
}

function exitPhotoMode() {
  state.mode = 'camera';
  state.importedImage = null;
  dom.importedPhoto.classList.add('hidden');
  dom.cameraVideo.classList.remove('hidden');
  dom.btnExitPhoto.classList.add('hidden');
  dom.btnFlipCamera.classList.remove('hidden');
  logger.info('Ritorno alla modalità fotocamera live');
  runSceneColorSample();
  scheduleOverlayRedraw();
}

async function forcePurgeAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
      }
    }
  } catch (err) {
    logger.warn('Errore pulizia cache', err);
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
        }
      }
      logger.info('Cache e Service Worker rimossi per garantire aggiornamenti istantanei');
    } catch (err) {
      logger.warn('Pulizia Service Worker non riuscita', err);
    }
  }
}

async function bootstrap() {
  logger.info('Avvio applicazione CoverCam');
  setupDialogLightDismissFallback();
  setupLongPressDebug();
  setupStageInteractions();
  renderPalette();
  renderGuideBar();
  renderFilterBar();
  renderGradingPresets();
  renderBlendModeBars();
  updateGradingUI();

  try {
    const res = await fetch('./presets.json', { cache: 'no-store' });
    const data = await res.json();
    state.genres = data.genres || [];
    state.presets = data.presets || [];
    for (const preset of state.presets) originalEditorialTexts.set(preset.id, preset.elements.map(el => el.text));
    logger.info('Preset caricati da presets.json', { count: state.presets.length });
  } catch (err) {
    logger.error('Errore caricamento presets.json', err);
  }

  dom.editorialLineGap?.addEventListener('input', () => {
    state.editorialLineGap = Number(dom.editorialLineGap.value) / 100;
    dom.editorialLineGapValue.textContent = dom.editorialLineGap.value + '%';
    scheduleOverlayRedraw();
  });
  dom.btnResetEditorialFocus?.addEventListener('click', () => {
    const preset = getCurrentPreset();
    if (!preset) return;
    const original = originalEditorialTexts.get(preset.id);
    if (!original) return;
    preset.elements.forEach((el, index) => { el.text = original[index]; });
    renderEditorialFocusFields();
    scheduleOverlayRedraw();
  });
  renderGenreTabs();
  updateStageDimensions();
  updatePresetUI();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      logger.debug('Font editoriali pronti');
      scheduleOverlayRedraw();
    });
  }

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (dom.btnInstallPwa) {
      dom.btnInstallPwa.classList.remove('hidden');
      dom.btnInstallPwa.setAttribute('aria-pressed', 'true');
    }
    logger.info('PWA pronta per installazione (beforeinstallprompt)');
  });

  if (dom.btnInstallPwa) {
    dom.btnInstallPwa.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      logger.info('Esito prompt installazione PWA', { outcome });
      deferredInstallPrompt = null;
      dom.btnInstallPwa.classList.add('hidden');
    });
  }

  window.addEventListener('resize', updateStageDimensions);

  if (dom.btnPrevVariant) {
    dom.btnPrevVariant.addEventListener('click', () => switchVariant(-1));
  }
  if (dom.btnNextVariant) {
    dom.btnNextVariant.addEventListener('click', () => switchVariant(1));
  }

  if (dom.btnToggleGenresBar && dom.genreTabs) {
    dom.btnToggleGenresBar.addEventListener('click', () => {
      if (dom.variantPickerRow && !dom.variantPickerRow.classList.contains('hidden')) {
        dom.variantPickerRow.classList.add('hidden');
        if (dom.btnToggleVariantList) dom.btnToggleVariantList.setAttribute('aria-expanded', 'false');
        if (dom.variantChevron) dom.variantChevron.textContent = '▾';
      }
      const isHidden = dom.genreTabs.classList.toggle('hidden');
      dom.btnToggleGenresBar.setAttribute('aria-expanded', String(!isHidden));
      if (dom.genreChevron) dom.genreChevron.textContent = isHidden ? '▾' : '▴';
      updateStageDimensions();
    });
  }

  if (dom.btnToggleVariantList && dom.variantPickerRow) {
    dom.btnToggleVariantList.addEventListener('click', () => {
      if (dom.genreTabs && !dom.genreTabs.classList.contains('hidden')) {
        dom.genreTabs.classList.add('hidden');
        if (dom.btnToggleGenresBar) dom.btnToggleGenresBar.setAttribute('aria-expanded', 'false');
        if (dom.genreChevron) dom.genreChevron.textContent = '▾';
      }
      const isHidden = dom.variantPickerRow.classList.toggle('hidden');
      dom.btnToggleVariantList.setAttribute('aria-expanded', String(!isHidden));
      if (dom.variantChevron) dom.variantChevron.textContent = isHidden ? '▾' : '▴';
      updateStageDimensions();
    });
  }

  if (dom.btnToggleQuickDock && dom.quickDockContainer) {
    dom.btnToggleQuickDock.addEventListener('click', () => {
      const isHidden = dom.quickDockContainer.classList.toggle('hidden');
      dom.btnToggleQuickDock.setAttribute('aria-expanded', String(!isHidden));
      if (dom.dockChevron) dom.dockChevron.textContent = isHidden ? '▴' : '▾';
      updateStageDimensions();
    });
  }

  for (const sheet of [dom.lookGradingPanel, dom.settingsDrawer]) {
    if (!sheet) continue;
    const detailsList = sheet.querySelectorAll('details.acc-section');
    for (const det of detailsList) {
      det.addEventListener('toggle', () => {
        if (det.open) {
          for (const other of detailsList) {
            if (other !== det && other.open) other.open = false;
          }
        }
      });
    }
  }

  dom.btnSettingsToggle.addEventListener('click', () => {
    if (dom.lookGradingPanel) dom.lookGradingPanel.classList.add('hidden');
    const isHidden = dom.settingsDrawer.classList.toggle('hidden');
    dom.btnSettingsToggle.setAttribute('aria-expanded', String(!isHidden));
  });

  if (dom.btnCloseSettingsSheet) {
    dom.btnCloseSettingsSheet.addEventListener('click', () => {
      dom.settingsDrawer.classList.add('hidden');
      dom.btnSettingsToggle.setAttribute('aria-expanded', 'false');
    });
  }

  if (dom.btnCloseLookSheet) {
    dom.btnCloseLookSheet.addEventListener('click', () => {
      dom.lookGradingPanel.classList.add('hidden');
      dom.btnGenreLookToggle.setAttribute('aria-pressed', String(state.grading.enabled));
    });
  }

  if (dom.btnGenreLookToggle) {
    dom.btnGenreLookToggle.addEventListener('click', () => {
      if (dom.settingsDrawer) {
        dom.settingsDrawer.classList.add('hidden');
        dom.btnSettingsToggle.setAttribute('aria-expanded', 'false');
      }
      const isHidden = dom.lookGradingPanel.classList.toggle('hidden');
      dom.btnGenreLookToggle.setAttribute('aria-pressed', String(!isHidden || state.grading.enabled));
      logger.info('Apertura/chiusura pannello Color Grading 60-30-10', { open: !isHidden });
    });
  }

  if (dom.btnToggleGradingEnable) {
    dom.btnToggleGradingEnable.addEventListener('click', () => {
      state.grading.enabled = !state.grading.enabled;
      state.filterId = state.grading.enabled ? 'auto-genre' : 'none';
      dom.btnToggleGradingEnable.classList.toggle('active', state.grading.enabled);
      dom.btnToggleGradingEnable.setAttribute('aria-pressed', String(state.grading.enabled));
      dom.btnToggleGradingEnable.querySelector('span').textContent = state.grading.enabled ? '60·30·10 ON' : '60·30·10 OFF';
      if (dom.dockLookBadge) {
        const shortBlend = {
          'multiply': 'Mult.',
          'difference': 'Diff.',
          'overlay': 'Over.',
          'soft-light': 'Soft',
          'color-burn': 'Burn',
          'exclusion': 'Excl.'
        };
        dom.dockLookBadge.textContent = state.grading.enabled ? (shortBlend[state.lightBlendMode] || 'ON') : 'OFF';
      }
      applyVideoFilter();
      scheduleOverlayRedraw();
    });
  }

  if (dom.btnGuideCycle) {
    dom.btnGuideCycle.addEventListener('click', () => {
      const idx = COMPOSITION_GUIDES.findIndex(g => g.id === state.compositionGuide);
      const next = COMPOSITION_GUIDES[(idx + 1) % COMPOSITION_GUIDES.length];
      state.compositionGuide = next.id;
      logger.info('Ciclo rapido guida composizione', { guide: next.id, label: next.label });
      updateGuideUI();
      scheduleOverlayRedraw();
    });
  }

  dom.gradingStrengthSlider.addEventListener('input', (e) => {
    state.grading.strength = Number(e.target.value) / 100;
    scheduleOverlayRedraw();
  });

  const onCustomGradeColor = () => {
    state.grading.triadId = 'custom';
    state.grading.c60 = dom.color60Input.value;
    state.grading.c30 = dom.color30Input.value;
    state.grading.c10 = dom.color10Input.value;
    updateGradingUI();
    scheduleOverlayRedraw();
  };

  dom.color60Input.addEventListener('input', onCustomGradeColor);
  dom.color30Input.addEventListener('input', onCustomGradeColor);
  dom.color10Input.addEventListener('input', onCustomGradeColor);

  if (dom.contrastToneSlider) {
    dom.contrastToneSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      state.toneAdjust.contrast = val;
      dom.contrastToneValue.textContent = `${val}%`;
      applyVideoFilter();
    });
  }

  if (dom.brightnessToneSlider) {
    dom.brightnessToneSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      state.toneAdjust.brightness = val;
      dom.brightnessToneValue.textContent = `${val}%`;
      applyVideoFilter();
    });
  }

  dom.opacitySlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.opacity = val / 100;
    dom.opacityValue.textContent = `${val}%`;
    scheduleOverlayRedraw();
  });

  dom.btnAutoColor.addEventListener('click', () => {
    state.colorMode = 'auto';
    logger.info('Modalità colore testo impostata su Auto Scena');
    runSceneColorSample();
    updateColorUI();
    scheduleOverlayRedraw();
  });

  dom.btnLightModeToggle.addEventListener('click', () => {
    state.lightSpotMode = !state.lightSpotMode;
    dom.btnLightModeToggle.setAttribute('aria-pressed', String(state.lightSpotMode));
    dom.lightModeStatusText.textContent = state.lightSpotMode ? 'ON' : 'OFF';
    if (state.lightSpotMode && state.lightSpots.length === 0) {
      state.lightSpots.push({
        x: 0.5,
        y: 0.42,
        radius: state.defaultHaloRadius,
        intensity: state.defaultHaloIntensity,
        blendMode: state.lightBlendMode
      });
      state.activeSpotIndex = 0;
    }
    updateLightSpotsUI();
    scheduleOverlayRedraw();
    logger.info('Modalità aggiunta punti luce col tocco', { enabled: state.lightSpotMode });
  });

  dom.btnClearLights.addEventListener('click', () => {
    state.lightSpots = [];
    state.activeSpotIndex = -1;
    updateLightSpotsUI();
    scheduleOverlayRedraw();
    logger.info('Punti luce rimossi');
  });

  if (dom.btnQuickLightHud) {
    dom.btnQuickLightHud.addEventListener('click', () => {
      toggleLightHud();
    });
  }

  if (dom.btnCloseLightHud) {
    dom.btnCloseLightHud.addEventListener('click', () => {
      toggleLightHud(false);
    });
  }

  if (dom.btnAddCenterHalo) {
    dom.btnAddCenterHalo.addEventListener('click', () => {
      const offset = (state.lightSpots.length % 5) * 0.05 - 0.1;
      state.lightSpots.push({
        x: Math.max(0.15, Math.min(0.85, 0.5 + offset)),
        y: Math.max(0.15, Math.min(0.85, 0.42 + offset * 0.6)),
        radius: state.defaultHaloRadius,
        intensity: state.defaultHaloIntensity,
        blendMode: state.lightBlendMode
      });
      state.activeSpotIndex = state.lightSpots.length - 1;
      updateLightSpotsUI();
      scheduleOverlayRedraw();
    });
  }

  if (dom.btnClearLightsHud) {
    dom.btnClearLightsHud.addEventListener('click', () => {
      state.lightSpots = [];
      state.activeSpotIndex = -1;
      updateLightSpotsUI();
      scheduleOverlayRedraw();
    });
  }

  if (dom.haloIntensitySlider) {
    dom.haloIntensitySlider.addEventListener('input', (e) => {
      setHaloIntensity(Number(e.target.value));
    });
  }

  if (dom.drawerHaloIntensitySlider) {
    dom.drawerHaloIntensitySlider.addEventListener('input', (e) => {
      setHaloIntensity(Number(e.target.value));
    });
  }

  if (dom.haloRadiusSlider) {
    dom.haloRadiusSlider.addEventListener('input', (e) => {
      setHaloRadius(Number(e.target.value));
    });
  }

  if (dom.drawerHaloRadiusSlider) {
    dom.drawerHaloRadiusSlider.addEventListener('input', (e) => {
      setHaloRadius(Number(e.target.value));
    });
  }

  dom.btnFaceCutoutToggle.addEventListener('click', () => {
    state.faceCutoutEnabled = !state.faceCutoutEnabled;
    subjectMask.enabled = state.faceCutoutEnabled;
    dom.btnFaceCutoutToggle.setAttribute('aria-pressed', String(state.faceCutoutEnabled));
    dom.btnFaceCutoutToggle.classList.toggle('active', state.faceCutoutEnabled);
    dom.faceCutoutStatusText.textContent = state.faceCutoutEnabled ? 'ON' : 'OFF';
    logger.info('Scontorno volto su testata', { enabled: state.faceCutoutEnabled });
    runSceneColorSample();
    scheduleOverlayRedraw();
  });

  if (dom.faceSizeSlider) {
    dom.faceSizeSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      dom.faceSizeValue.textContent = `${val}%`;
      subjectMask.setSize(val / 100);
      if (!state.faceCutoutEnabled) {
        state.faceCutoutEnabled = true;
        subjectMask.enabled = true;
        dom.btnFaceCutoutToggle.setAttribute('aria-pressed', 'true');
        dom.btnFaceCutoutToggle.classList.add('active');
        dom.faceCutoutStatusText.textContent = 'ON';
      }
      scheduleOverlayRedraw();
    });
  }

  if (dom.faceFeatherSlider) {
    dom.faceFeatherSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      dom.faceFeatherValue.textContent = `${val}%`;
      subjectMask.setFeather(val / 100);
      scheduleOverlayRedraw();
    });
  }

  dom.btnHorizonToggle.addEventListener('click', async () => {
    if (!horizonLevel.enabled) {
      const ok = await horizonLevel.enable();
      dom.btnHorizonToggle.setAttribute('aria-pressed', String(ok));
      dom.horizonStatusText.textContent = ok ? 'ON' : 'N/D';
    } else {
      horizonLevel.disable();
      dom.btnHorizonToggle.setAttribute('aria-pressed', 'false');
      dom.horizonStatusText.textContent = 'OFF';
    }
    scheduleOverlayRedraw();
  });

  dom.btnSafeZoneToggle.addEventListener('click', () => {
    state.showSafeZones = !state.showSafeZones;
    dom.btnSafeZoneToggle.setAttribute('aria-pressed', String(state.showSafeZones));
    dom.safeZoneStatusText.textContent = state.showSafeZones ? 'ON' : 'OFF';
    logger.info('Toggle zone sicure Story', { enabled: state.showSafeZones });
    scheduleOverlayRedraw();
  });

  dom.btnFormatCycle.addEventListener('click', () => {
    const currentIdx = FORMAT_KEYS.indexOf(state.formatId);
    const nextIdx = (currentIdx + 1) % FORMAT_KEYS.length;
    state.formatId = FORMAT_KEYS[nextIdx];
    const fmt = FORMATS[state.formatId];
    dom.formatRatioText.textContent = fmt.desc;
    dom.formatNameText.textContent = fmt.label;
    logger.info('Cambio formato composizione', { format: state.formatId, ratio: fmt.desc });
    updateStageDimensions();
    runSceneColorSample();
  });

  dom.btnFlipCamera.addEventListener('click', async () => {
    try {
      await camera.toggleFacingMode();
      runSceneColorSample();
    } catch (err) {
      logger.error('Errore cambio fotocamera', err);
    }
  });

  dom.btnRetryCamera.addEventListener('click', initCamera);
  dom.btnExitPhoto.addEventListener('click', exitPhotoMode);

  dom.btnImportGallery.addEventListener('click', () => {
    dom.galleryInput.value = '';
    dom.galleryInput.click();
  });

  dom.galleryInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleGalleryFile(file);
  });

  dom.btnShutter.addEventListener('click', handleShutter);

  dom.btnDownloadCover.addEventListener('click', () => {
    if (state.lastCapture) {
      triggerDownload(state.lastCapture.coverBlob, state.lastCapture.coverFilename);
    }
  });

  dom.btnDownloadClean.addEventListener('click', () => {
    if (state.lastCapture) {
      triggerDownload(state.lastCapture.cleanBlob, state.lastCapture.cleanFilename);
    }
  });

  dom.btnDownloadBoth.addEventListener('click', () => {
    if (state.lastCapture) {
      downloadBoth(state.lastCapture);
    }
  });

  dom.btnShareBoth.addEventListener('click', async () => {
    if (!state.lastCapture) return;
    try {
      await shareCapture(state.lastCapture);
    } catch (err) {
      logger.warn('Condivisione annullata o non riuscita', err);
    }
  });

  const auditButton = document.getElementById('btnAuditLayouts');
  const auditOutput = document.getElementById('auditLayoutOutput');
  if (auditButton && auditOutput) auditButton.addEventListener('click', async () => {
    auditButton.disabled = true;
    auditOutput.textContent = 'Analisi dei 189 layout in corso…';
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D non disponibile');
      const findings = [];
      let passed = 0;
      const widths = 1000;
      for (const preset of state.presets) {
        for (const format of Object.values(FORMATS)) {
          canvas.width = widths;
          canvas.height = Math.round(widths / format.ratio);
          const boxes = [];
          renderCoverOverlay(ctx, canvas.width, canvas.height, preset, {
            formatId: format.id, auditBoxes: boxes, colorMode: 'preset',
            showSafeZones: false, editorialLineGap: 1
          });
          const issues = [];
          const space = widths * 0.02;
          const minFonts = { masthead: 70, headline: 36, lead: 23, body: 20, kicker: 19, issue: 18, cta: 18 };
          for (const b of boxes) {
            if (b.left < -1 || b.right > canvas.width + 1 || b.top < space - 1 || b.bottom > canvas.height - space + 1)
              issues.push({ type: 'bounds', role: b.role, box: b });
            if (b.fontPx < (minFonts[b.role] || 18))
              issues.push({ type: 'small-text', role: b.role, actualPx: b.fontPx, minimumPx: minFonts[b.role] || 18 });
            if (b.truncated) issues.push({ type: 'truncated', role: b.role });
          }
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i], b = boxes[j];
              const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (horizontal > 0 && vertical > 0) issues.push({ type: 'overlap', roles: [a.role, b.role], overlapPx: Math.round(vertical) });
              else if (horizontal > 0 && Math.abs(vertical) < space * 2)
                issues.push({ type: 'tight-gap', roles: [a.role, b.role], gapPx: Math.round(-vertical), minimumPx: space * 2 });
            }
          }
          if (!issues.length) passed++;
          findings.push({ presetId: preset.id, presetName: preset.name, format: format.id, status: issues.length ? 'FAIL' : 'PASS', issues });
        }
      }
      const report = { version: 1, date: new Date().toISOString(), total: findings.length, passed, failed: findings.length - passed, findings };
      auditOutput.textContent = `${passed}/${findings.length} PASS · ${findings.length - passed} FAIL. Il report JSON elenca le violazioni per preset e formato.`;
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'covercam-layout-audit.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      auditOutput.textContent = `Errore validazione: ${err.message}`;
    } finally {
      auditButton.disabled = false;
    }
  });

  dom.btnCopyLogs.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(logger.formatText());
      dom.btnCopyLogs.textContent = 'Copiato!';
      setTimeout(() => { dom.btnCopyLogs.textContent = 'Copia log'; }, 1500);
    } catch (err) {
      logger.warn('Impossibile copiare negli appunti', err);
    }
  });

  dom.btnClearLogs.addEventListener('click', () => {
    logger.clear();
    refreshDebugLogs();
    forcePurgeAndReload();
  });

  if (dom.btnHardResetCache) {
    dom.btnHardResetCache.addEventListener('click', () => {
      forcePurgeAndReload();
    });
  }

  logger.subscribe(() => {
    if (dom.debugDialog.open) {
      refreshDebugLogs();
    }
  });

  setInterval(() => {
    if (!document.hidden && !dom.exportDialog.open) {
      runSceneColorSample();
    }
  }, 500);

  setTimeout(() => {
    dom.swipeHint.classList.add('fade-out');
  }, 4500);

  await initCamera();
  await registerServiceWorker();
}

bootstrap();
