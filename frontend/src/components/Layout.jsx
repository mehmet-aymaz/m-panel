import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const location = useLocation();
  
  // Determine page title based on path
  const getPageDetails = () => {
    switch (location.pathname) {
      case '/':
        return {
          title: 'Genel Bakış',
          subtitle: 'Sistem durumu ve sunucu istatistikleri'
        };
      case '/inbounds':
        return {
          title: 'Inbound Yönetimi',
          subtitle: 'Bağlantı noktaları ve protokol yapılandırmaları'
        };
      case '/clients':
        return {
          title: 'Kullanıcı Yönetimi',
          subtitle: 'Müşteri profilleri, kotalar ve süre takibi'
        };
      default:
        return {
          title: 'M-Panel',
          subtitle: 'Yönetim Konsolu'
        };
    }
  };

  const { title, subtitle } = getPageDetails();

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <header className="header-bar animate-fade-in">
          <div className="page-title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="user-profile-badge">
            <div className="profile-avatar">A</div>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>admin</span>
          </div>
        </header>
        <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
