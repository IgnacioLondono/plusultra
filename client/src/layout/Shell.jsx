import { Layers } from 'lucide-react';
import { NAVIGATION } from '../navigation';

export function SubTabs({ items, active, onChange }) {
  return (
    <nav className="subtabs">
      {items.map((item) => {
        const Icon = item.Icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`subtab ${active === item.id ? 'active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {Icon && <Icon size={15} strokeWidth={2} />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions, breadcrumb }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {breadcrumb && (
          <div className="breadcrumb">
            <span>{breadcrumb.section}</span>
            {breadcrumb.sub && (
              <>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">{breadcrumb.sub}</span>
              </>
            )}
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Sidebar({ section, sub, onNavigate, connected }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <div className="brand-icon-wrap">
            <Layers size={22} strokeWidth={2.2} />
          </div>
          <div>
            <div className="brand-name">Plusultra</div>
            <div className="brand-sub">Container Management</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAVIGATION.map((group) => {
          const GroupIcon = group.Icon;
          const isActive = section === group.id;
          return (
            <div key={group.id} className="nav-group">
              <button
                type="button"
                className={`nav-group-header ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(group.id, group.subs[0].id)}
              >
                <GroupIcon size={18} strokeWidth={2} />
                <span>{group.label}</span>
              </button>
              {isActive && (
                <div className="nav-sublist">
                  {group.subs.map((item) => {
                    const SubIcon = item.Icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`nav-subitem ${sub === item.id ? 'active' : ''}`}
                        onClick={() => onNavigate(group.id, item.id)}
                      >
                        <SubIcon size={14} strokeWidth={2} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className={`connection-badge ${connected ? 'online' : 'offline'}`}>
          <span className="connection-dot" />
          <div>
            <div className="connection-label">{connected ? 'Conectado' : 'Desconectado'}</div>
            <div className="connection-sub">Docker Engine</div>
          </div>
        </div>
      </div>
    </aside>
  );
}