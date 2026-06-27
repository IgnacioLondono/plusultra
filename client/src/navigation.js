import {
  LayoutDashboard,
  Box,
  Layers,
  HardDrive,
  Network,
  Database,
  Activity,
  Settings,
  List,
  Plus,
  BarChart3,
  Rocket,
  FileCode,
  Download,
  Terminal,
  ScrollText,
  Radio,
  Sliders,
  Plug,
  Server,
  Settings2,
  Palette,
} from 'lucide-react';

export const NAVIGATION = [
  {
    id: 'home',
    label: 'Inicio',
    Icon: LayoutDashboard,
    subs: [
      { id: 'overview', label: 'Resumen', Icon: LayoutDashboard },
      { id: 'system', label: 'Sistema', Icon: Server },
    ],
  },
  {
    id: 'containers',
    label: 'Contenedores',
    Icon: Box,
    subs: [
      { id: 'list', label: 'Listado', Icon: List },
      { id: 'create', label: 'Crear', Icon: Plus },
      { id: 'configure', label: 'Configurar', Icon: Settings2 },
      { id: 'stats', label: 'Estadísticas', Icon: BarChart3 },
    ],
  },
  {
    id: 'stacks',
    label: 'Stacks',
    Icon: Layers,
    subs: [
      { id: 'list', label: 'Listado', Icon: List },
      { id: 'deploy', label: 'Desplegar', Icon: Rocket },
      { id: 'editor', label: 'Editor Compose', Icon: FileCode },
    ],
  },
  {
    id: 'images',
    label: 'Imágenes',
    Icon: HardDrive,
    subs: [
      { id: 'list', label: 'Listado', Icon: List },
      { id: 'pull', label: 'Descargar', Icon: Download },
    ],
  },
  {
    id: 'networks',
    label: 'Redes',
    Icon: Network,
    subs: [
      { id: 'list', label: 'Listado', Icon: List },
      { id: 'create', label: 'Crear', Icon: Plus },
    ],
  },
  {
    id: 'volumes',
    label: 'Volúmenes',
    Icon: Database,
    subs: [
      { id: 'list', label: 'Listado', Icon: List },
      { id: 'create', label: 'Crear', Icon: Plus },
    ],
  },
  {
    id: 'monitor',
    label: 'Monitor',
    Icon: Activity,
    subs: [
      { id: 'logs', label: 'Logs', Icon: ScrollText },
      { id: 'terminal', label: 'Terminal', Icon: Terminal },
      { id: 'events', label: 'Eventos', Icon: Radio },
    ],
  },
  {
    id: 'settings',
    label: 'Configuración',
    Icon: Settings,
    subs: [
      { id: 'general', label: 'General', Icon: Sliders },
      { id: 'appearance', label: 'Apariencia', Icon: Palette },
      { id: 'docker', label: 'Conexión Docker', Icon: Plug },
    ],
  },
];

export function getNavItem(sectionId) {
  return NAVIGATION.find((n) => n.id === sectionId);
}

export function getBreadcrumb(section, sub) {
  const nav = getNavItem(section);
  if (!nav) return { section: 'Inicio', sub: '' };
  const subItem = nav.subs.find((s) => s.id === sub);
  return { section: nav.label, sub: subItem?.label || '' };
}
