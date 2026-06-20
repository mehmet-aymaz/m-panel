import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Radio, Users, LogOut, Shield } from 'lucide-react';
import { logout } from '../services/api';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">M</div>
        <span>M-Panel</span>
      </div>
      
      <nav className="sidebar-menu">
        <NavLink 
          to="/" 
          end
          className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} />
          <span>Genel Bakış</span>
        </NavLink>
        
        <NavLink 
          to="/inbounds" 
          className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
        >
          <Radio size={20} />
          <span>Inbound Yönetimi</span>
        </NavLink>
        
        <NavLink 
          to="/clients" 
          className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
        >
          <Users size={20} />
          <span>Kullanıcı Yönetimi</span>
        </NavLink>
      </nav>
      
      <div className="sidebar-footer">
        <button className="logout-button" onClick={logout}>
          <LogOut size={20} />
          <span>Oturumu Kapat</span>
        </button>
      </div>
    </aside>
  );
}
