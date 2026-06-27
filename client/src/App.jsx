import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, LogOut } from 'lucide-react';
import { api } from './api';
import { useToast } from './components/shared';
import { Sidebar, SubTabs, PageHeader } from './layout/Shell';
import { NAVIGATION, getNavItem, getBreadcrumb } from './navigation';
import { getAuthToken, setAuthToken } from './utils/auth';
import { applyAppearance, pickPublicAppearance } from './utils/theme';
import Login from './components/Login';

import Dashboard from './components/Dashboard';
import Containers from './components/Containers';
import Images from './components/Images';
import Volumes from './components/Volumes';
import Networks from './components/Networks';
import Launch from './components/Launch';
import Logs from './components/Logs';
import Terminal from './components/Terminal';
import Settings from './components/Settings';
import Stacks from './components/Stacks';
import Events from './components/Events';
import SystemInfo, { ContainerStats } from './components/SystemInfo';
import ContainerConfigure from './components/ContainerConfigure';

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [publicConfig, setPublicConfig] = useState(null);
  const [section, setSection] = useState('home');
  const [sub, setSub] = useState('overview');
  const [config, setConfig] = useState(null);
  const [connected, setConnected] = useState(false);
  const [monitorTarget, setMonitorTarget] = useState({ logs: null, terminal: null });
  const { addToast, ToastContainer } = useToast();

  const navigate = useCallback((sec, sb) => {
    setSection(sec);
    setSub(sb);
  }, []);

  const checkConnection = useCallback(async () => {
    if (!user) return;
    try {
      const result = await api.ping();
      setConnected(result.ok);
    } catch {
      setConnected(false);
    }
  }, [user]);

  const handleConfigSave = useCallback((cfg) => {
    setConfig(cfg);
    setPublicConfig(pickPublicAppearance(cfg));
    applyAppearance(cfg);
  }, []);

  const handleConfigPreview = useCallback((preview) => {
    setConfig((prev) => (prev ? { ...prev, ...preview } : preview));
  }, []);

  const loadPublicConfig = useCallback(async () => {
    try {
      const cfg = await api.getPublicConfig();
      setPublicConfig(cfg);
      applyAppearance(cfg);
    } catch { /* ignore */ }
  }, []);

  const handleLogout = useCallback(async () => {
    await api.logout();
    setAuthToken(null);
    setUser(null);
    setConfig(null);
    loadPublicConfig();
  }, [loadPublicConfig]);

  useEffect(() => {
    loadPublicConfig();
    const token = getAuthToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    api.me()
      .then(({ user: u }) => setUser(u))
      .catch(() => setAuthToken(null))
      .finally(() => setAuthChecking(false));

    const onLogout = () => handleLogout();
    window.addEventListener('plusultra:logout', onLogout);
    return () => window.removeEventListener('plusultra:logout', onLogout);
  }, [handleLogout, loadPublicConfig]);

  useEffect(() => {
    if (!user) return;
    api.getConfig().then((cfg) => {
      handleConfigSave(cfg);
    });
    checkConnection();
  }, [user, checkConnection, handleConfigSave]);

  useEffect(() => {
    if (!config?.autoRefresh || !user) return;
    const id = setInterval(checkConnection, config.refreshInterval);
    return () => clearInterval(id);
  }, [checkConnection, config, user]);

  const onLogin = (username) => {
    setUser(username);
    setAuthChecking(false);
  };

  if (authChecking) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span>Cargando Plusultra...</span>
      </div>
    );
  }

  if (!user) {
    return <Login publicConfig={publicConfig} onLogin={onLogin} />;
  }

  const navItem = getNavItem(section);
  const breadcrumb = getBreadcrumb(section, sub);
  const props = { connected, config, addToast, sub, onNavigate: navigate };

  const renderContent = () => {
    if (!config) {
      return (
        <div className="loading-center">
          <div className="spinner" />
          <span>Cargando configuración...</span>
        </div>
      );
    }

    switch (section) {
      case 'home':
        if (sub === 'system') return <SystemInfo {...props} />;
        return <Dashboard {...props} />;
      case 'containers':
        if (sub === 'create') return <Launch {...props} onLaunched={() => navigate('containers', 'list')} />;
        if (sub === 'stats') return <ContainerStats {...props} />;
        if (sub === 'configure') return <ContainerConfigure {...props} />;
        return (
          <Containers
            {...props}
            onOpenLogs={(id) => { setMonitorTarget((p) => ({ ...p, logs: id })); navigate('monitor', 'logs'); }}
            onOpenTerminal={(id) => { setMonitorTarget((p) => ({ ...p, terminal: id })); navigate('monitor', 'terminal'); }}
          />
        );
      case 'stacks':
        return <Stacks {...props} />;
      case 'images':
        return <Images {...props} />;
      case 'networks':
        return <Networks {...props} />;
      case 'volumes':
        return <Volumes {...props} />;
      case 'monitor':
        if (sub === 'terminal') {
          return (
            <Terminal
              {...props}
              initialContainer={monitorTarget.terminal}
              onClearTarget={() => setMonitorTarget((p) => ({ ...p, terminal: null }))}
            />
          );
        }
        if (sub === 'events') return <Events {...props} />;
        return (
          <Logs
            {...props}
            initialContainer={monitorTarget.logs}
            onClearTarget={() => setMonitorTarget((p) => ({ ...p, logs: null }))}
          />
        );
      case 'settings':
        return (
          <Settings
            config={config}
            onSave={handleConfigSave}
            onPreview={handleConfigPreview}
            addToast={addToast}
            sub={sub}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        section={section}
        sub={sub}
        onNavigate={navigate}
        connected={connected}
        config={config}
        user={user}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <div className="content-inner">
          <PageHeader
            breadcrumb={breadcrumb}
            title={breadcrumb.sub || breadcrumb.section}
            actions={
              <>
                <button type="button" className="btn btn-ghost btn-icon" onClick={checkConnection} title="Actualizar conexión">
                  <RefreshCw size={16} />
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout} title="Cerrar sesión">
                  <LogOut size={16} /> Salir
                </button>
              </>
            }
          />

          {navItem && (
            <SubTabs
              items={navItem.subs}
              active={sub}
              onChange={(id) => navigate(section, id)}
            />
          )}

          <div className="page-body">{renderContent()}</div>
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
