function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return null;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lighten(hex, amount = 0.15) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const { r, g, b } = rgb;
  const mix = (c) => Math.min(255, Math.round(c + (255 - c) * amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function ensureBgLayer() {
  let layer = document.getElementById('plusultra-bg');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'plusultra-bg';
    layer.setAttribute('aria-hidden', 'true');
    document.body.prepend(layer);
  }
  return layer;
}

export function applyAppearance(cfg = {}) {
  const root = document.documentElement;
  const theme = cfg.theme || 'dark';
  root.dataset.theme = theme;

  const title = cfg.appTitle?.trim() || 'Plusultra';
  document.title = `${title} — Panel Docker`;

  if (cfg.accentColor) {
    root.style.setProperty('--accent', cfg.accentColor);
    root.style.setProperty('--accent-hover', lighten(cfg.accentColor, 0.12));
    const rgb = hexToRgb(cfg.accentColor);
    if (rgb) {
      root.style.setProperty('--accent-dim', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
    }
  }

  const sidebarOpacity = cfg.sidebarOpacity ?? 1;
  const panelOpacity = cfg.panelOpacity ?? 0.92;
  root.style.setProperty('--sidebar-opacity', String(sidebarOpacity));
  root.style.setProperty('--panel-opacity', String(panelOpacity));

  const sidebarRgb = theme === 'light' ? '255, 255, 255' : '23, 27, 38';
  const panelRgb = theme === 'light' ? '255, 255, 255' : '26, 31, 46';
  const panelHeaderRgb = theme === 'light' ? '248, 249, 252' : '30, 36, 51';

  root.style.setProperty('--bg-sidebar-trans', `rgba(${sidebarRgb}, ${sidebarOpacity})`);
  root.style.setProperty('--bg-panel-trans', `rgba(${panelRgb}, ${panelOpacity})`);
  root.style.setProperty('--bg-panel-header-trans', `rgba(${panelHeaderRgb}, ${Math.min(1, panelOpacity + 0.03)})`);

  const bgLayer = ensureBgLayer();
  const type = cfg.backgroundType || 'gradient';
  const overlay = cfg.backgroundOverlay ?? 0.35;

  bgLayer.style.backgroundImage = '';
  bgLayer.style.background = '';
  bgLayer.style.backgroundColor = 'transparent';

  if (type === 'image' && cfg.backgroundImage) {
    const src = cfg.backgroundImage.startsWith('data:') || cfg.backgroundImage.startsWith('http')
      ? cfg.backgroundImage
      : `${cfg.backgroundImage}${cfg.backgroundImage.includes('?') ? '&' : '?'}v=${cfg.backgroundVersion || 0}`;
    bgLayer.style.backgroundImage = `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${src}")`;
    bgLayer.style.backgroundSize = 'cover';
    bgLayer.style.backgroundPosition = 'center';
    bgLayer.style.backgroundAttachment = 'fixed';
    bgLayer.style.backgroundRepeat = 'no-repeat';
    bgLayer.style.backgroundColor = cfg.backgroundColor || '#0f1117';
  } else if (type === 'solid') {
    bgLayer.style.background = cfg.backgroundColor || (theme === 'light' ? '#f0f2f7' : '#0f1117');
  } else {
    bgLayer.style.background = cfg.backgroundGradient
      || 'linear-gradient(135deg, #0f1117 0%, #1a1035 50%, #0f1117 100%)';
  }

  document.body.style.background = 'transparent';
}

export function pickPublicAppearance(cfg) {
  return {
    appTitle: cfg.appTitle,
    appSubtitle: cfg.appSubtitle,
    theme: cfg.theme,
    accentColor: cfg.accentColor,
    backgroundType: cfg.backgroundType,
    backgroundColor: cfg.backgroundColor,
    backgroundGradient: cfg.backgroundGradient,
    backgroundImage: cfg.backgroundImage,
    backgroundVersion: cfg.backgroundVersion,
    backgroundOverlay: cfg.backgroundOverlay,
    sidebarOpacity: cfg.sidebarOpacity,
    panelOpacity: cfg.panelOpacity,
  };
}
