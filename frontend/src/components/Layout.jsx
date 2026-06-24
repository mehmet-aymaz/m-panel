import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useSettings } from '../context/SettingsContext';
import { Menu } from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const { t } = useSettings();
  const [headerStats, setHeaderStats] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }
    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [isMobileMenuOpen]);
  

  const renderStats = () => {
    if (!headerStats) return null;
    
    if (headerStats.type === 'clients') {
      return (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="stat-pill">
            <span className="stat-pill-label">{t('stat_total')}</span>
            <span className="stat-pill-val">{headerStats.total}</span>
          </div>
          <div className="stat-pill online">
            <span className="stat-pill-dot online-pulse-dot"></span>
            <span className="stat-pill-label">{t('stat_online')}</span>
            <span className="stat-pill-val">{headerStats.online}</span>
          </div>
          <div className="stat-pill active">
            <span className="stat-pill-label">{t('stat_active')}</span>
            <span className="stat-pill-val">{headerStats.active}</span>
          </div>
          <div className="stat-pill expired">
            <span className="stat-pill-label">{t('stat_expired')}</span>
            <span className="stat-pill-val">{headerStats.expired}</span>
          </div>
          <div className="stat-pill disabled">
            <span className="stat-pill-label">{t('stat_disabled')}</span>
            <span className="stat-pill-val">{headerStats.disabled}</span>
          </div>
        </div>
      );
    }
    
    if (headerStats.type === 'inbounds') {
      return (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="stat-pill">
            <span className="stat-pill-label">{t('stat_total')}</span>
            <span className="stat-pill-val">{headerStats.total}</span>
          </div>
          <div className="stat-pill active">
            <span className="stat-pill-label">{t('stat_active')}</span>
            <span className="stat-pill-val">{headerStats.active}</span>
          </div>
          <div className="stat-pill disabled">
            <span className="stat-pill-label">{t('stat_passive')}</span>
            <span className="stat-pill-val">{headerStats.disabled}</span>
          </div>
        </div>
      );
    }
    
    return null;
  };

  const stats = renderStats();

  return (
    <div className="app-container">
      {/* Mobile Top Bar */}
      <div className="mobile-header glass-card">
        <button 
          className="mobile-menu-btn" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          type="button"
        >
          <Menu size={20} />
        </button>
        <div className="mobile-brand">
          <div className="brand-icon">M</div>
          <span>M-Panel</span>
        </div>
      </div>

      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="main-content">
        {location.pathname !== '/' && stats && (
          <header className="header-bar animate-fade-in">
            {/* Dynamic Page Statistics */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {stats}
            </div>
          </header>
        )}
        <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Outlet context={{ setHeaderStats }} />
        </div>
      </main>
    </div>
  );
}
