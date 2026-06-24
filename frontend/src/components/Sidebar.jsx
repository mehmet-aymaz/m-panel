import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Radio, Users, LogOut, ChevronLeft, ChevronRight, Terminal, BookOpen, Key, Settings, Server } from 'lucide-react';
import { logout } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';

export default function Sidebar({ isOpen, onClose }) {
  const { t } = useSettings();
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed);
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    return () => {
      document.body.classList.remove('sidebar-collapsed');
    };
  }, [isCollapsed]);

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        
        <div className="sidebar-header">
          <div className="sidebar-brand glass-card">
            <div className="brand-icon">M</div>
            <span>M-Panel</span>
          </div>
          
          <button 
            className="sidebar-toggle glass-card" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            type="button"
            title={isCollapsed ? t('expand') || 'Genişlet' : t('collapse') || 'Daralt'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
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
            onClick={handleLinkClick}
          >
            <LayoutDashboard size={20} />
            <span>{t('overview')}</span>
          </NavLink>
          
          <NavLink 
            to="/inbounds" 
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            onClick={handleLinkClick}
          >
            <Radio size={20} />
            <span>{t('inbound_mgmt')}</span>
          </NavLink>
          
          <NavLink 
            to="/clients" 
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            onClick={handleLinkClick}
          >
            <Users size={20} />
            <span>{t('client_mgmt')}</span>
          </NavLink>

          <NavLink 
            to="/nodes" 
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            onClick={handleLinkClick}
          >
            <Server size={20} />
            <span>{t('nodes_title')}</span>
          </NavLink>

          <NavLink 
            to="/logs" 
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            onClick={handleLinkClick}
          >
            <Terminal size={20} />
            <span>{t('system_logs') || 'Sistem Günlükleri'}</span>
          </NavLink>

          <NavLink 
            to="/api-tokens" 
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            onClick={handleLinkClick}
          >
            <Key size={20} />
            <span>{t('api_tokens') || 'API Anahtarları'}</span>
          </NavLink>

          <NavLink 
            to="/settings" 
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            onClick={handleLinkClick}
          >
            <Settings size={20} />
            <span>{t('settings_title') || 'Panel Ayarları'}</span>
          </NavLink>

          <NavLink 
            to="/api-docs" 
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            onClick={handleLinkClick}
          >
            <BookOpen size={20} />
            <span>{t('api_docs') || 'API Belgeleri'}</span>
          </NavLink>
        </nav>
        
        <div className="sidebar-footer">
          <button className="logout-button" onClick={() => { logout(); handleLinkClick(); }}>
            <LogOut size={20} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
