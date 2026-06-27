import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from './api';
import { useToast } from './components/shared';
import { Sidebar, SubTabs, PageHeader } from './layout/Shell';
import { NAVIGATION, getNavItem, getBreadcrumb } from './navigation';

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

export default function App() {
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
    try {
      const result = await api.ping();
      setConnected(result.ok);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    api.getConfig().then((cfg) => {
      setConfig(cfg);
      document.documentElement.style.setProperty('--accent', cfg.accentColor);
    });
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (!config?.autoRefresh) return;
    const id = setInterval(checkConnection, config.refreshInterval);
    return () => clearInterval(id);
  }, [checkConnection, config]);

  const navItem = getNavItem(section);
  const breadcrumb = getBreadcrumb(section, sub);
  const props = { connected, config, addToast, sub, onNavigate: navigate };

  const renderContent = () => {
    if (!config) {
      return (
        <div className="loading-center">
          <div className="spinner" />
          <span>Cargando Plusultra...</span>
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
        return <Settings config={config} onSave={setConfig} addToast={addToast} sub={sub} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar section={section} sub={sub} onNavigate={navigate} connected={connected} />

      <main className="main-content">
        <div className="content-inner">
          <PageHeader
            breadcrumb={breadcrumb}
            title={breadcrumb.sub || breadcrumb.section}
            actions={
              <button type="button" className="btn btn-ghost btn-icon" onClick={checkConnection} title="Actualizar conexión">
                <RefreshCw size={16} />
              </button>
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
