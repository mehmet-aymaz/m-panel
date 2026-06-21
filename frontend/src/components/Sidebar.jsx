import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Radio, Users, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { logout } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';

export default function Sidebar() {
  const { t } = useSettings();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('mpanel_sidebar_collapsed') === 'true');

  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    localStorage.setItem('mpanel_sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  return (
    <aside className="sidebar">
      {/* Collapse Toggle Button */}
      <button 
        className="sidebar-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Genişlet" : "Daralt"}
        type="button"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="sidebar-brand glass-card" style={{ justifyContent: 'center' }}>
        <div className="brand-icon">M</div>
        <span>M-Panel</span>
      </div>
      
      {/* Language & Theme Controls (Top Positioned) */}
      <div className="sidebar-switchers">
        <div style={{ flex: 1, display: 'flex', width: '100%' }}>
          <ThemeSwitcher />
        </div>
        <div style={{ flex: 1, display: 'flex', width: '100%' }}>
          <LanguageSwitcher />
        </div>
      </div>
      
      <nav className="sidebar-menu">
        <NavLink 
          to="/" 
          end
          className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} />
          <span>{t('overview')}</span>
        </NavLink>
        
        <NavLink 
          to="/inbounds" 
          className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
        >
          <Radio size={20} />
          <span>{t('inbound_mgmt')}</span>
        </NavLink>
        
        <NavLink 
          to="/clients" 
          className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
        >
          <Users size={20} />
          <span>{t('client_mgmt')}</span>
        </NavLink>
      </nav>
      
      <div className="sidebar-footer">
        <button className="logout-button" onClick={logout}>
          <LogOut size={20} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
}
