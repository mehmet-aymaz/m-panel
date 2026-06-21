import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useSettings } from '../context/SettingsContext';

export default function Layout() {
  const location = useLocation();
  const { t } = useSettings();
  const [headerStats, setHeaderStats] = useState(null);
  
  // Determine page title based on path
  const getPageDetails = () => {
    switch (location.pathname) {
      case '/':
        return {
          title: t('overview'),
          subtitle: t('system_status')
        };
      case '/inbounds':
        return {
          title: t('inbound_mgmt'),
          subtitle: t('inbound_desc')
        };
      case '/clients':
        return {
          title: t('client_mgmt'),
          subtitle: t('client_desc')
        };
      default:
        return {
          title: 'M-Panel',
          subtitle: 'Console'
        };
    }
  };

  const { title, subtitle } = getPageDetails();

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

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {location.pathname !== '/' && (
          <header className="header-bar animate-fade-in">
            <div className="page-title">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            
            {/* Dynamic Page Statistics */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {renderStats()}
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
