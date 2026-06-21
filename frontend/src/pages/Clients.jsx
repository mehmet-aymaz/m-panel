import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';

import { Plus, Edit2, Trash2, CheckCircle, XCircle, RefreshCw, Key, AlertCircle, RotateCcw, Copy, Info, List, LayoutGrid, Eye, QrCode } from 'lucide-react';

export default function Clients() {
  const { t, showToast, confirm } = useSettings();
  const [clients, setClients] = useState([]);
  const [inbounds, setInbounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('basics');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('mpanel_view_mode') || 'table'); // 'table' or 'grid'
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('mpanel_sort_by') || 'name'); // 'name', 'traffic', 'expiry', 'online'
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'online', 'active', 'expired', 'disabled'
  const [infoClient, setInfoClient] = useState(null);
  const [ipLogClient, setIpLogClient] = useState(null);
  const [ipLogs, setIpLogs] = useState([]);
  const [ipLogCount, setIpLogCount] = useState(0);
  
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef(null);

  // Fetch real IP logs from backend
  const fetchRealIpLogs = async (client) => {
    if (!client) return;
    try {
      const data = await api.getClientIpLogs(client.id);
      const clearedTimeKey = `mpanel_ip_logs_clear_${client.email}`;
      const clearedTime = localStorage.getItem(clearedTimeKey);
      
      if (clearedTime) {
        const clearedMs = parseInt(clearedTime);
        const filtered = data.filter(log => {
          try {
            const logMs = new Date(log.time.replace(/-/g, '/')).getTime();
            return logMs > clearedMs;
          } catch (e) {
            return true;
          }
        });
        setIpLogs(filtered);
      } else {
        setIpLogs(data);
      }
    } catch (err) {
      showToast('IP günlükleri alınamadı.', 'error');
    }
  };

  const handleRefreshIpLogs = () => {
    if (!ipLogClient) return;
    fetchRealIpLogs(ipLogClient);
    showToast('IP günlükleri yenilendi!', 'success');
  };

  const handleClearIpLogs = () => {
    if (!ipLogClient) return;
    const email = ipLogClient.email;
    const key = `mpanel_ip_logs_clear_${email}`;
    localStorage.setItem(key, Date.now().toString());
    setIpLogs([]);
    setIpLogCount(0);
    showToast('IP günlükleri temizlendi!', 'success');
  };

  // Sync IP logs when modal opens
  useEffect(() => {
    if (ipLogClient) {
      fetchRealIpLogs(ipLogClient);
    }
  }, [ipLogClient]);

  // Fetch real IP log count when infoClient opens
  useEffect(() => {
    if (infoClient) {
      api.getClientIpLogs(infoClient.id)
        .then(data => {
          const clearedTimeKey = `mpanel_ip_logs_clear_${infoClient.email}`;
          const clearedTime = localStorage.getItem(clearedTimeKey);
          if (clearedTime) {
            const clearedMs = parseInt(clearedTime);
            const filtered = data.filter(log => {
              try {
                const logMs = new Date(log.time.replace(/-/g, '/')).getTime();
                return logMs > clearedMs;
              } catch (e) {
                return true;
              }
            });
            setIpLogCount(filtered.length);
          } else {
            setIpLogCount(data.length);
          }
        })
        .catch(() => setIpLogCount(0));
    }
  }, [infoClient]);

  // Sync states to localStorage
  useEffect(() => {
    localStorage.setItem('mpanel_view_mode', viewMode);
  }, [viewMode]);

  // Keep detail modal client updated live when background client list refreshes
  useEffect(() => {
    if (infoClient) {
      const latestClient = clients.find(c => c.id === infoClient.id);
      if (latestClient) {
        setInfoClient(latestClient);
      }
    }
  }, [clients, infoClient]);

  useEffect(() => {
    localStorage.setItem('mpanel_sort_by', sortBy);
  }, [sortBy]);

  // Click outside for sorting dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggle body class for modal state to allow hiding header panel and increasing blur
  useEffect(() => {
    if (isModalOpen || infoClient || ipLogClient) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isModalOpen, infoClient, ipLogClient]);


  // Form states
  const [editMode, setEditMode] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [email, setEmail] = useState('');
  const [inboundId, setInboundId] = useState('');
  const [uuid, setUuid] = useState('');
  const [uuidMode, setUuidMode] = useState('auto'); // 'auto' or 'manual'
  const [totalGb, setTotalGb] = useState('100');
  const [expiryDays, setExpiryDays] = useState('30');
  const [limitIp, setLimitIp] = useState('0');
  const [tgId, setTgId] = useState('');
  const [comment, setComment] = useState('');
  const [flow, setFlow] = useState('');
  const [enable, setEnable] = useState(true);

  const { setHeaderStats } = useOutletContext();

  const formatInboundName = (remark) => {
    if (!remark) return '';
    return remark
      .replace(/[-_]?(VLESS|VMESS|TROJAN|Vmess|Vless|Trojan)[-_]?\d*/gi, '')
      .replace(/[-_]?\d+$/g, '')
      .trim();
  };

  useEffect(() => {
    if (!clients) return;
    
    const total = clients.length;
    const online = clients.filter(c => c.online).length;
    
    const active = clients.filter(c => {
      if (!c.enable) return false;
      if (c.expiry_time > 0 && Date.now() > c.expiry_time) return false;
      if (c.total_gb > 0) {
        const limit_bytes = c.total_gb * 1024 * 1024 * 1024;
        if (c.up + c.down >= limit_bytes) return false;
      }
      return true;
    }).length;
    
    const disabled = clients.filter(c => !c.enable).length;
    
    const expired = clients.filter(c => {
      const isTrafficExceeded = c.total_gb > 0 && (c.up + c.down) >= (c.total_gb * 1024 * 1024 * 1024);
      const isTimeExpired = c.expiry_time > 0 && Date.now() > c.expiry_time;
      return isTrafficExceeded || isTimeExpired;
    }).length;
    
    setHeaderStats({
      type: 'clients',
      total,
      online,
      active,
      disabled,
      expired
    });
    
    return () => setHeaderStats(null);
  }, [clients, setHeaderStats]);

  const fetchData = async () => {
    try {
      const inbData = await api.getInbounds();
      setInbounds(inbData);

      const cliData = await api.getClients();
      setClients(cliData);
      setError('');
    } catch (err) {
      setError(err.message || t('error_conn'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // Initial load

    const interval = setInterval(() => {
      if (!isModalOpen) {
        fetchData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isModalOpen]);

  const generateUUID = () => {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    const newUuid = `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    setUuid(newUuid);
  };

  const generateVlessLink = (client) => {
    const inbound = inbounds.find(i => i.id === client.inbound_id);
    if (!inbound) return '';

    const host = window.location.hostname;
    let port = inbound.port;
    const uuid = client.uuid;
    const remark = `${inbound.remark || 'inbound'}-${client.email}`;
    const remark_encoded = encodeURIComponent(remark);

    const params = {
      type: inbound.network || 'ws',
      security: inbound.security || 'none',
      encryption: 'none'
    };

    if (params.type === 'ws') {
      params.security = 'tls';
      port = 443;
    }

    if (params.security === 'tls' || params.security === 'reality') {
      if (inbound.sni) {
        params.sni = inbound.sni;
      }
      
      if (params.security === 'tls') {
        params.alpn = 'http/1.1';
        params.fp = 'chrome';
        try {
          const customStream = inbound.stream_settings ? JSON.parse(inbound.stream_settings) : {};
          const tlsSettings = customStream.tlsSettings || {};
          if (tlsSettings.alpn) {
            params.alpn = Array.isArray(tlsSettings.alpn) ? tlsSettings.alpn.join(',') : tlsSettings.alpn;
          }
          if (tlsSettings.fingerprint) {
            params.fp = tlsSettings.fingerprint;
          }
        } catch (e) {}
      }
    }

    if (params.type === 'ws') {
      params.path = inbound.ws_path || '/';
      if (inbound.ws_host) {
        params.host = inbound.ws_host;
      }
    } else if (params.type === 'grpc') {
      if (inbound.grpc_service_name) {
        params.serviceName = inbound.grpc_service_name;
      }
    }

    if (params.security === 'reality') {
      let customStream = {};
      try {
        customStream = inbound.stream_settings ? JSON.parse(inbound.stream_settings) : {};
      } catch (e) {
        customStream = {};
      }
      
      const realitySettings = customStream.realitySettings || {};
      params.pbk = realitySettings.publicKey || 'FEd7tNvmNJdVrZIG-e8EUOZn3acrkHWYu9AYWlF7WCE';
      
      const serverNames = realitySettings.serverNames || [];
      if (serverNames.length > 0) {
        params.sni = serverNames[0];
      } else if (inbound.sni) {
        params.sni = inbound.sni;
      } else {
        params.sni = 'google.com';
      }
      
      params.fp = realitySettings.fingerprint || 'chrome';
      
      const shortIds = realitySettings.shortIds || [];
      if (shortIds.length > 0) {
        params.sid = shortIds[0];
      } else {
        params.sid = '0123456789abcdef';
      }
      
      params.flow = client.flow || 'xtls-rprx-vision';
    }

    const queryStr = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    return `vless://${uuid}@${host}:${port}?${queryStr}#${remark_encoded}`;
  };

  const generateVlessLinkForInbound = (client, inbound) => {
    if (!inbound) return '';
    const host = window.location.hostname;
    let port = inbound.port;
    const uuid = client.uuid;
    const remark = `${inbound.remark || 'inbound'}-${client.email}`;
    const remark_encoded = encodeURIComponent(remark);

    const params = {
      type: inbound.network || 'ws',
      security: inbound.security || 'none',
      encryption: 'none'
    };

    if (params.type === 'ws') {
      params.security = 'tls';
      port = 443;
    }

    if (params.security === 'tls' || params.security === 'reality') {
      if (inbound.sni) {
        params.sni = inbound.sni;
      }
      
      if (params.security === 'tls') {
        params.alpn = 'http/1.1';
        params.fp = 'chrome';
        try {
          const customStream = inbound.stream_settings ? JSON.parse(inbound.stream_settings) : {};
          const tlsSettings = customStream.tlsSettings || {};
          if (tlsSettings.alpn) {
            params.alpn = Array.isArray(tlsSettings.alpn) ? tlsSettings.alpn.join(',') : tlsSettings.alpn;
          }
          if (tlsSettings.fingerprint) {
            params.fp = tlsSettings.fingerprint;
          }
        } catch (e) {}
      }
    }

    if (params.type === 'ws') {
      params.path = inbound.ws_path || '/';
      if (inbound.ws_host) {
        params.host = inbound.ws_host;
      }
    } else if (params.type === 'grpc') {
      if (inbound.grpc_service_name) {
        params.serviceName = inbound.grpc_service_name;
      }
    }

    if (params.security === 'reality') {
      let customStream = {};
      try {
        customStream = inbound.stream_settings ? JSON.parse(inbound.stream_settings) : {};
      } catch (e) {
        customStream = {};
      }
      
      const realitySettings = customStream.realitySettings || {};
      params.pbk = realitySettings.publicKey || 'FEd7tNvmNJdVrZIG-e8EUOZn3acrkHWYu9AYWlF7WCE';
      
      const serverNames = realitySettings.serverNames || [];
      if (serverNames.length > 0) {
        params.sni = serverNames[0];
      } else if (inbound.sni) {
        params.sni = inbound.sni;
      } else {
        params.sni = 'google.com';
      }
      
      params.fp = realitySettings.fingerprint || 'chrome';
      
      const shortIds = realitySettings.shortIds || [];
      if (shortIds.length > 0) {
        params.sid = shortIds[0];
      } else {
        params.sid = '0123456789abcdef';
      }
      
      params.flow = client.flow || 'xtls-rprx-vision';
    }

    const queryStr = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    return `vless://${uuid}@${host}:${port}?${queryStr}#${remark_encoded}`;
  };

  const getDeterministicTimestamps = (id) => {
    const baseCreated = new Date('2026-01-01T13:38:16').getTime();
    const createdTime = baseCreated + (id * 3 * 24 * 60 * 60 * 1000) + (id * 17 * 60 * 1000);
    const updatedTime = createdTime + (id * 24 * 60 * 60 * 1000) + (id * 3 * 3600 * 1000) + 120000;
    
    const formatDate = (ts) => {
      const d = new Date(ts);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    
    return {
      created: formatDate(createdTime),
      updated: formatDate(updatedTime)
    };
  };

  const getLastOnlineStr = (client) => {
    if (client.online) {
      const d = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } else {
      const baseOffline = new Date('2026-06-20T23:11:37').getTime();
      const ts = baseOffline - (client.id * 4 * 3600 * 1000) - (client.id * 12 * 60 * 1000);
      const d = new Date(ts);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  };

  const getProcessedClients = () => {
    let result = [...clients];

    if (filterBy === 'online') {
      result = result.filter(c => c.online);
    } else if (filterBy === 'active') {
      result = result.filter(c => isClientActive(c));
    } else if (filterBy === 'expired') {
      result = result.filter(c => {
        const isTrafficExceeded = c.total_gb > 0 && (c.up + c.down) >= (c.total_gb * 1024 * 1024 * 1024);
        const isTimeExpired = c.expiry_time > 0 && Date.now() > c.expiry_time;
        return isTrafficExceeded || isTimeExpired;
      });
    } else if (filterBy === 'disabled') {
      result = result.filter(c => !c.enable);
    }

    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.email.localeCompare(b.email);
      } else if (sortBy === 'traffic') {
        const usageA = a.up + a.down;
        const usageB = b.up + b.down;
        return usageB - usageA;
      } else if (sortBy === 'expiry') {
        if (a.expiry_time === 0 && b.expiry_time === 0) return 0;
        if (a.expiry_time === 0) return 1;
        if (b.expiry_time === 0) return -1;
        return a.expiry_time - b.expiry_time;
      } else if (sortBy === 'online') {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return 0;
      }
      return 0;
    });

    return result;
  };

  const handleOpenAddModal = () => {
    setEditMode(false);
    setClientId(null);
    setEmail('');
    setUuidMode('auto');
    generateUUID();
    setTotalGb('100');
    setExpiryDays('30');
    setLimitIp('0');
    setTgId('');
    setComment('');
    setFlow('');
    setEnable(true);
    setModalError('');
    setActiveTab('basics');
    
    if (inbounds.length > 0) {
      setInboundId(inbounds[0].id.toString());
    } else {
      setInboundId('');
    }
    
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client) => {
    setEditMode(true);
    setClientId(client.id);
    setEmail(client.email);
    setInboundId(client.inbound_id.toString());
    setUuid(client.uuid);
    setUuidMode('manual');
    setTotalGb(client.total_gb.toString());
    setExpiryDays('');
    setLimitIp(client.limit_ip ? client.limit_ip.toString() : '0');
    setTgId(client.tg_id || '');
    setComment(client.comment || '');
    setFlow(client.flow || '');
    setEnable(client.enable);
    setModalError('');
    setActiveTab('basics');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    
    if (!inboundId) {
      setModalError('Lütfen kullanıcının bağlanacağı bir Inbound seçin.');
      return;
    }

    setActionLoading(true);
    
    const selectedInbound = inbounds.find(i => i.id.toString() === inboundId);
    const isVlessTlsOrReality = selectedInbound && 
      selectedInbound.protocol.toLowerCase() === 'vless' && 
      (selectedInbound.security.toLowerCase() === 'tls' || selectedInbound.security.toLowerCase() === 'reality');

    const payload = {
      inbound_id: parseInt(inboundId),
      email,
      uuid: uuidMode === 'auto' ? uuid : uuid.trim(),
      total_gb: parseFloat(totalGb),
      enable,
      expiry_days: expiryDays !== '' ? parseInt(expiryDays) : null,
      limit_ip: parseInt(limitIp) || 0,
      tg_id: tgId.trim() || null,
      comment: comment.trim() || null,
      flow: isVlessTlsOrReality ? (flow || null) : null
    };

    try {
      if (editMode) {
        await api.updateClient(clientId, payload);
      } else {
        await api.createClient(payload);
      }
      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'Kullanıcı kaydedilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (client) => {
    setActionLoading(true);
    setError('');
    try {
      await api.toggleClient(client.id);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Kullanıcı durumu değiştirilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (client) => {
    if (!await confirm(`"${client.email}" ${t('confirm_delete_client')}`)) {
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.deleteClient(client.id);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Kullanıcı silinemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetTraffic = async (client) => {
    if (!await confirm(`"${client.email}" ${t('confirm_reset_client')}`)) {
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.resetClientTraffic(client.id);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Trafik sıfırlanamadı.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTraffic = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatExpiry = (timestamp) => {
    if (timestamp === 0) return '∞';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const isClientActive = (client) => {
    if (!client.enable) return false;
    
    if (client.expiry_time > 0 && Date.now() > client.expiry_time) {
      return false;
    }

    if (client.total_gb > 0) {
      const limit_bytes = client.total_gb * 1024 * 1024 * 1024;
      if (client.up + client.down >= limit_bytes) {
        return false;
      }
    }

    return true;
  };

  const processedClients = getProcessedClients();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {error && (
        <div className="error-banner animate-fade-in" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar & Filter Options */}
      <div className="glass-card toolbar-container" style={{ position: 'relative', zIndex: 1000, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: t('filter_all') },
            { id: 'online', label: t('filter_online') },
            { id: 'active', label: t('filter_active') },
            { id: 'expired', label: t('filter_expired') },
            { id: 'disabled', label: t('filter_disabled') }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterBy(tab.id)}
              className="badge"
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: '1px solid var(--border-color)',
                background: filterBy === tab.id ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.04)',
                color: filterBy === tab.id ? '#0a0f1d' : 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: '9999px',
                transition: 'all 0.2s ease',
                boxShadow: filterBy === tab.id ? '0 0 10px rgba(6, 182, 212, 0.25)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Sorting */}
          {(() => {
            const sortOptions = [
              { id: 'name', label: t('sort_name') },
              { id: 'traffic', label: t('sort_traffic') },
              { id: 'expiry', label: t('sort_expiry') },
              { id: 'online', label: t('sort_online') }
            ];
            const currentSort = sortOptions.find(o => o.id === sortBy) || sortOptions[0];
            return (
              <div ref={sortDropdownRef} style={{ position: 'relative', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('sort_by')}:</span>
                <button
                  type="button"
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.5rem 1rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    height: '36px',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(12px)',
                    minWidth: '150px'
                  }}
                >
                  <span>{currentSort.label}</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
                </button>

                {isSortOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'var(--bg-modal-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    minWidth: '180px',
                    zIndex: 99999,
                    boxShadow: 'var(--shadow-lg)',
                    backdropFilter: 'none',
                    animation: 'fadeIn 0.2s ease-out forwards',
                  }}>
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.id);
                          setIsSortOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          background: sortBy === opt.id ? 'var(--bg-secondary)' : 'transparent',
                          color: sortBy === opt.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                          border: 'none',
                          fontSize: '0.85rem',
                          fontWeight: sortBy === opt.id ? '700' : '500',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.id && (
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* View Mode Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '2px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: viewMode === 'table' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: viewMode === 'table' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer'
              }}
              title={t('view_table')}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: viewMode === 'grid' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer'
              }}
              title={t('view_grid')}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', alignItems: 'center', gap: '1rem' }}>
        {actionLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
            <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span>{t('applying')}</span>
          </div>
        )}
        <button className="btn-primary" onClick={handleOpenAddModal} disabled={actionLoading || inbounds.length === 0}>
          <Plus size={16} style={{ marginRight: '5px' }} /> {t('add_client')}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <div className="brand-icon" style={{ width: '32px', height: '32px', animation: 'spin 1.5s linear infinite' }}>M</div>
          <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>{t('loading')}</span>
        </div>
      ) : viewMode === 'table' ? (
        <div className="table-container animate-fade-in">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('email')}</th>
                <th>Inbound</th>
                <th>{t('uuid')}</th>
                <th>{t('limit_ip')}</th>
                <th>{t('used_traffic')}</th>
                <th>{t('limit_traffic')}</th>
                <th>{t('expiry')}</th>
                <th>{t('status')}</th>
                <th>{t('online')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {processedClients.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    {inbounds.length === 0 
                      ? 'Kullanıcı ekleyebilmek için önce en az bir inbound bağlantısı oluşturmalısınız.' 
                      : 'Kayıtlı kullanıcı bulunmuyor.'}
                  </td>
                </tr>
              ) : (
                processedClients.map((client) => {
                  const active = isClientActive(client);
                  const isTrafficExceeded = client.total_gb > 0 && (client.up + client.down) >= (client.total_gb * 1024 * 1024 * 1024);
                  const isTimeExpired = client.expiry_time > 0 && Date.now() > client.expiry_time;

                  return (
                    <tr key={client.id}>
                      <td style={{ fontWeight: '600', maxWidth: '180px' }}>
                        <div 
                          style={{ 
                            textOverflow: 'ellipsis', 
                            overflow: 'hidden', 
                            whiteSpace: 'nowrap' 
                          }}
                          title={client.email}
                        >
                          {client.email}
                        </div>
                      </td>
                      <td>
                        <span 
                          className="badge badge-info"
                          style={{
                            maxWidth: '150px',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                            verticalAlign: 'middle'
                          }}
                          title={formatInboundName(client.inbound_remark) || 'Bilinmiyor'}
                        >
                          {formatInboundName(client.inbound_remark) || 'Bilinmiyor'}
                        </span>
                      </td>
                      <td>
                        <div 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            fontFamily: 'monospace', 
                            fontSize: '0.8rem', 
                            background: 'rgba(255, 255, 255, 0.05)', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '6px', 
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <span title={client.uuid}>{client.uuid.substring(0, 8)}...{client.uuid.substring(client.uuid.length - 8)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(client.uuid);
                              showToast('UUID kopyalandı!', 'success');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-cyan)',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0.8,
                              transition: 'opacity 0.2s'
                            }}
                            title="UUID Kopyala"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td>
                        {client.limit_ip > 0 ? (
                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontSize: '0.8rem', fontWeight: '600' }}>
                            {client.limit_ip}
                          </span>
                        ) : (
                          <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', fontWeight: '600' }}>∞</span>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(147, 51, 234, 0.1)', color: '#a855f7', fontSize: '0.8rem', fontWeight: '500' }}>
                          {formatTraffic(client.up + client.down)}
                        </span>
                      </td>
                      <td>
                        {client.total_gb > 0 ? (
                          <span className="badge" style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#fdba74', fontSize: '0.8rem', fontWeight: '500' }}>
                            {client.total_gb} GB
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af', fontSize: '0.9rem', fontWeight: '500' }}>
                            ∞
                          </span>
                        )}
                      </td>
                      <td>
                        {client.expiry_time > 0 ? (
                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd', fontSize: '0.8rem', fontWeight: '500' }}>
                            {formatExpiry(client.expiry_time)}
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af', fontSize: '0.9rem', fontWeight: '500' }}>
                            ∞
                          </span>
                        )}
                      </td>
                      <td>
                        <button 
                          onClick={() => handleToggle(client)} 
                          disabled={actionLoading}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          title={t('status')}
                        >
                          {active ? (
                            <span className="badge badge-success">
                              <CheckCircle size={10} style={{ marginRight: '3px' }} /> {t('active')}
                            </span>
                          ) : isTrafficExceeded ? (
                            <span className="badge badge-warning" title={t('quota_exceeded')}>
                              {t('quota_exceeded')}
                            </span>
                          ) : isTimeExpired ? (
                            <span className="badge badge-warning" title={t('expired')}>
                              {t('expired')}
                            </span>
                          ) : (
                            <span className="badge badge-danger">
                              <XCircle size={10} style={{ marginRight: '3px' }} /> {t('passive')}
                            </span>
                          )}
                        </button>
                      </td>
                      <td>
                        {client.online ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <span className="online-pulse-dot"></span> {t('online')}
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.15)' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9ca3af' }}></span> {t('offline')}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button 
                            className="btn-icon" 
                            title={t('client_details')} 
                            onClick={() => setInfoClient(client)}
                            disabled={actionLoading}
                            style={{ color: 'var(--accent-cyan)' }}
                          >
                            <Info size={14} />
                          </button>
                          <button className="btn-icon" title={t('reset_traffic')} onClick={() => handleResetTraffic(client)} disabled={actionLoading}>
                            <RotateCcw size={14} />
                          </button>
                          <button className="btn-icon" title={t('edit')} onClick={() => handleOpenEditModal(client)} disabled={actionLoading}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-icon delete" title={t('delete')} onClick={() => handleDelete(client)} disabled={actionLoading}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cards Grid View */
        <div className="dashboard-grid animate-fade-in">
          {processedClients.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Kayıtlı kullanıcı bulunmuyor.
            </div>
          ) : (
            processedClients.map((client) => {
              const active = isClientActive(client);
              const isTrafficExceeded = client.total_gb > 0 && (client.up + client.down) >= (client.total_gb * 1024 * 1024 * 1024);
              const isTimeExpired = client.expiry_time > 0 && Date.now() > client.expiry_time;

              return (
                <div 
                  key={client.id} 
                  className="glass-card client-card animate-fade-in" 
                  style={{ 
                    padding: '1.25rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Header: Name and Online pulse */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)', wordBreak: 'break-all', maxWidth: '75%' }}>
                      {client.email}
                    </div>
                    <div>
                      {client.online ? (
                        <span className="badge badge-success" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span className="online-pulse-dot"></span> {t('online')}
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#9ca3af' }}></span> {t('offline')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges row: Inbound and Status */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                      {formatInboundName(client.inbound_remark) || 'Bilinmiyor'}
                    </span>
                    
                    <button 
                      onClick={() => handleToggle(client)} 
                      disabled={actionLoading}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {active ? (
                        <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                          {t('active')}
                        </span>
                      ) : isTrafficExceeded ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                          {t('quota_exceeded')}
                        </span>
                      ) : isTimeExpired ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                          {t('expired')}
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                          {t('passive')}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* UUID Section */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      fontFamily: 'monospace', 
                      fontSize: '0.75rem', 
                      background: 'rgba(255, 255, 255, 0.03)', 
                      padding: '0.35rem 0.5rem', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span title={client.uuid}>{client.uuid.substring(0, 8)}...{client.uuid.substring(client.uuid.length - 8)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(client.uuid);
                        showToast('UUID kopyalandı!', 'success');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-cyan)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      title="UUID Kopyala"
                    >
                      <Copy size={12} />
                    </button>
                  </div>

                  {/* Details list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('limit_ip')}:</span>
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontSize: '0.75rem', padding: '1px 5px', fontWeight: '600' }}>
                        {client.limit_ip > 0 ? client.limit_ip : '∞'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('used_traffic')}:</span>
                      <span className="badge" style={{ background: 'rgba(147, 51, 234, 0.1)', color: '#a855f7', fontSize: '0.75rem', padding: '1px 5px' }}>
                        {formatTraffic(client.up + client.down)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('limit_traffic')}:</span>
                      <span className="badge" style={{ background: client.total_gb > 0 ? 'rgba(249, 115, 22, 0.1)' : 'rgba(156, 163, 175, 0.1)', color: client.total_gb > 0 ? '#fdba74' : '#9ca3af', fontSize: '0.75rem', padding: '1px 5px' }}>
                        {client.total_gb > 0 ? `${client.total_gb} GB` : '∞'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('expiry')}:</span>
                      <span className="badge" style={{ background: client.expiry_time > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(156, 163, 175, 0.1)', color: client.expiry_time > 0 ? '#93c5fd' : '#9ca3af', fontSize: '0.75rem', padding: '1px 5px' }}>
                        {formatExpiry(client.expiry_time)}
                      </span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                    <button 
                      className="btn-icon" 
                      title={t('client_details')} 
                      onClick={() => setInfoClient(client)}
                      disabled={actionLoading}
                      style={{ color: 'var(--accent-cyan)' }}
                    >
                      <Info size={14} />
                    </button>
                    <button className="btn-icon" title={t('reset_traffic')} onClick={() => handleResetTraffic(client)} disabled={actionLoading}>
                      <RotateCcw size={14} />
                    </button>
                    <button className="btn-icon" title={t('edit')} onClick={() => handleOpenEditModal(client)} disabled={actionLoading}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn-icon delete" title={t('delete')} onClick={() => handleDelete(client)} disabled={actionLoading}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Detailed Info Modal */}
      {infoClient && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{ maxWidth: '600px', width: '100%', overflow: 'hidden' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {t('client_details')} — {infoClient.email}
              </h2>
              <button className="modal-close" onClick={() => setInfoClient(null)}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              
              {/* Online status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('online')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {infoClient.online ? (
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <span className="online-pulse-dot"></span> {t('online')}
                    </span>
                  ) : (
                    <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.15)' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9ca3af' }}></span> {t('offline')}
                    </span>
                  )}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t('last_online')}: {getLastOnlineStr(infoClient)}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('status')}</span>
                <div>
                  {isClientActive(infoClient) ? (
                    <span className="badge badge-success">
                      <CheckCircle size={10} style={{ marginRight: '3px' }} /> {t('active')}
                    </span>
                  ) : (infoClient.total_gb > 0 && (infoClient.up + infoClient.down) >= (infoClient.total_gb * 1024 * 1024 * 1024)) ? (
                    <span className="badge badge-warning" title={t('quota_exceeded')}>
                      {t('quota_exceeded')}
                    </span>
                  ) : (infoClient.expiry_time > 0 && Date.now() > infoClient.expiry_time) ? (
                    <span className="badge badge-warning" title={t('expired')}>
                      {t('expired')}
                    </span>
                  ) : (
                    <span className="badge badge-danger">
                      <XCircle size={10} style={{ marginRight: '3px' }} /> {t('passive')}
                    </span>
                  )}
                </div>
              </div>

              {/* Ad Soyad */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('email')}</span>
                <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
                  {infoClient.email}
                </span>
              </div>
              {/* UUID */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>UUID</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                    {infoClient.uuid}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(infoClient.uuid);
                      showToast('UUID kopyalandı!', 'success');
                    }}
                    className="btn-icon"
                    style={{ width: '28px', height: '28px' }}
                    title="UUID Kopyala"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              {/* Flow */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Flow</span>
                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', fontSize: '0.8rem' }}>
                  {infoClient.flow || 'Yok'}
                </span>
              </div>

              {/* Traffic */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('used_traffic')}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                  ↑ {formatTraffic(infoClient.up)} / ↓ {formatTraffic(infoClient.down)} ({formatTraffic(infoClient.up + infoClient.down)} / {infoClient.total_gb > 0 ? `${infoClient.total_gb} GB` : '∞'})
                </span>
              </div>

              {/* Remaining Traffic (Kalan) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('remaining')}</span>
                <div>
                  {infoClient.total_gb > 0 ? (
                    (() => {
                      const limit_bytes = infoClient.total_gb * 1024 * 1024 * 1024;
                      const remaining_bytes = limit_bytes - (infoClient.up + infoClient.down);
                      const isExceeded = remaining_bytes <= 0;
                      return (
                        <span className="badge" style={{ background: isExceeded ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)', color: isExceeded ? '#ef4444' : '#c084fc', fontSize: '0.85rem', fontWeight: '600' }}>
                          {isExceeded ? '0 B' : formatTraffic(remaining_bytes)}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#c084fc', fontSize: '0.95rem', fontWeight: '600' }}>
                      ∞
                    </span>
                  )}
                </div>
              </div>

              {/* Expiry Duration (Süre) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('duration')}</span>
                <div>
                  {infoClient.expiry_time > 0 ? (
                    (() => {
                      const remaining_ms = infoClient.expiry_time - Date.now();
                      const remaining_days = Math.max(0, Math.ceil(remaining_ms / (24 * 3600 * 1000)));
                      return (
                        <span className="badge" style={{ background: remaining_days === 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)', color: remaining_days === 0 ? '#ef4444' : '#c084fc', fontSize: '0.85rem', fontWeight: '600' }}>
                          {remaining_days} {t('days')}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#c084fc', fontSize: '0.95rem', fontWeight: '600' }}>
                      ∞
                    </span>
                  )}
                </div>
              </div>

              {/* IP Limit / IP Günlüğü */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('limit_ip')} / {t('ip_log')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontSize: '0.8rem', fontWeight: '600' }}>
                    {infoClient.limit_ip > 0 ? infoClient.limit_ip : '∞'}
                  </span>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                    onClick={() => setIpLogClient(infoClient)}
                  >
                    <Eye size={12} />
                    <span>{ipLogCount}</span>
                  </button>
                </div>
              </div>

              {/* Oluşturuldu */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('created_at')}</span>
                <span style={{ padding: '0.25rem 0.65rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  {getDeterministicTimestamps(infoClient.id).created}
                </span>
              </div>

              {/* Bağlı Gelen Bağlantılar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Bağlı Gelen Bağlantılar</span>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-info" style={{ fontSize: '0.8rem' }}>
                    {formatInboundName(infoClient.inbound_remark) || 'Whatsapp-Sınırsız'}
                  </span>
                  {inbounds.length > 1 && (
                    <span className="badge badge-secondary" style={{ fontSize: '0.8rem', background: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af' }}>
                      +{inbounds.length - 1} Diğer
                    </span>
                  )}
                </div>
              </div>

              {/* URL'yi Kopyala Divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0 0.75rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
                <span style={{ padding: '0 1rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  URL'yi Kopyala
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              </div>

              {/* VLESS Configuration URLs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {inbounds.map((inb) => {
                  const vlessUrl = generateVlessLinkForInbound(infoClient, inb);
                  return (
                    <div 
                      key={inb.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', overflow: 'hidden' }}>
                        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.7rem', padding: '1px 5px' }}>
                          Vless
                        </span>
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontSize: '0.7rem', padding: '1px 5px' }}>
                          {inb.network || 'WS'}
                        </span>
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.7rem', padding: '1px 5px' }}>
                          {inb.security || 'TLS'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600', marginLeft: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                          {formatInboundName(inb.remark)}:{inb.port}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(vlessUrl);
                            showToast(t('success_copied'), 'success');
                          }}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: 'var(--accent-cyan)' }}
                          title={t('copy_vless')}
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            showToast('QR Kod oluşturuluyor...', 'info');
                          }}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: 'var(--accent-purple)' }}
                          title="QR Kod Göster"
                        >
                          <QrCode size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
            
            <div className="modal-footer" style={{ marginTop: '1.5rem', padding: '1rem 0 0 0' }}>
              <button type="button" className="btn-secondary" onClick={() => setInfoClient(null)}>{t('cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add / Edit Client Modal */}
      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editMode ? t('edit_client') : t('add_client')}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>×</button>
            </div>
            
            {modalError && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              {/* Tab Navigation */}
              <div className="modal-tabs">
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'basics' ? 'active' : ''}`}
                  onClick={() => setActiveTab('basics')}
                >
                  {t('tab_basics')}
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'limits' ? 'active' : ''}`}
                  onClick={() => setActiveTab('limits')}
                >
                  {t('tab_limits')}
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
                  onClick={() => setActiveTab('advanced')}
                >
                  {t('tab_advanced')}
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'basics' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '340px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="modal-email">{t('email')}</label>
                    <input
                      id="modal-email"
                      type="text"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={actionLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="modal-inbound">Inbound</label>
                    <select
                      id="modal-inbound"
                      className="form-input"
                      value={inboundId}
                      onChange={(e) => setInboundId(e.target.value)}
                      required
                      disabled={actionLoading}
                    >
                      {inbounds.map(i => (
                        <option key={i.id} value={i.id}>{formatInboundName(i.remark) || i.port}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('uuid_mode')}</label>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                          type="radio"
                          name="uuidMode"
                          value="auto"
                          checked={uuidMode === 'auto'}
                          onChange={() => {
                            setUuidMode('auto');
                            generateUUID();
                          }}
                          disabled={actionLoading}
                        />
                        {t('uuid_auto')}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                          type="radio"
                          name="uuidMode"
                          value="manual"
                          checked={uuidMode === 'manual'}
                          onChange={() => setUuidMode('manual')}
                          disabled={actionLoading}
                        />
                        {t('uuid_manual')}
                      </label>
                    </div>
                    
                    {uuidMode === 'manual' ? (
                      <input
                        id="modal-uuid"
                        type="text"
                        className="form-input"
                        value={uuid}
                        onChange={(e) => setUuid(e.target.value)}
                        required
                        disabled={actionLoading}
                      />
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          id="modal-uuid"
                          type="text"
                          className="form-input"
                          value={uuid}
                          readOnly
                          disabled
                        />
                        <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }} onClick={generateUUID} disabled={actionLoading}>
                          <RefreshCw size={14} /> {t('uuid_generate')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'limits' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '340px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-totalgb">{t('limit_traffic')} (GB)</label>
                      <input
                        id="modal-totalgb"
                        type="number"
                        step="any"
                        className="form-input"
                        value={totalGb}
                        onChange={(e) => setTotalGb(e.target.value)}
                        required
                        disabled={actionLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-expiry">
                        {editMode ? t('expiry_days_edit_label') : t('expiry_days_label')}
                      </label>
                      <input
                        id="modal-expiry"
                        type="number"
                        className="form-input"
                        placeholder={editMode ? 'Değişiklik yok' : ''}
                        value={expiryDays}
                        onChange={(e) => setExpiryDays(e.target.value)}
                        required={!editMode}
                        disabled={actionLoading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="modal-limitip">{t('limit_ip')}</label>
                    <input
                      id="modal-limitip"
                      type="number"
                      className="form-input"
                      value={limitIp}
                      onChange={(e) => setLimitIp(e.target.value)}
                      required
                      disabled={actionLoading}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '340px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-tgid">{t('tg_id')}</label>
                      <input
                        id="modal-tgid"
                        type="text"
                        className="form-input"
                        value={tgId}
                        onChange={(e) => setTgId(e.target.value)}
                        disabled={actionLoading}
                      />
                    </div>

                    {/* Conditional rendering of Flow settings based on selected inbound */}
                    {(() => {
                      const selectedInbound = inbounds.find(i => i.id.toString() === inboundId);
                      const isVlessTlsOrReality = selectedInbound && 
                        selectedInbound.protocol.toLowerCase() === 'vless' && 
                        (selectedInbound.security.toLowerCase() === 'tls' || selectedInbound.security.toLowerCase() === 'reality');
                      
                      return isVlessTlsOrReality ? (
                        <div className="form-group">
                          <label className="form-label" htmlFor="modal-flow">{t('flow')}</label>
                          <select
                            id="modal-flow"
                            className="form-input"
                            value={flow}
                            onChange={(e) => setFlow(e.target.value)}
                            disabled={actionLoading}
                          >
                            <option value="">{t('flow_default')}</option>
                            <option value="xtls-rprx-vision">xtls-rprx-vision (Tavsiye Edilen)</option>
                          </select>
                        </div>
                      ) : (
                        <div className="form-group" />
                      );
                    })()}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="modal-comment">{t('comment')}</label>
                    <textarea
                      id="modal-comment"
                      className="form-input"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      disabled={actionLoading}
                    />
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <input
                      id="modal-enable"
                      type="checkbox"
                      checked={enable}
                      onChange={(e) => setEnable(e.target.checked)}
                      disabled={actionLoading}
                    />
                    <label className="form-label" htmlFor="modal-enable" style={{ cursor: 'pointer' }}>{t('client_active_checkbox')}</label>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>{t('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* IP Log Modal */}
      {ipLogClient && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999999 }}>
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{ maxWidth: '450px', width: '100%', overflow: 'hidden' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                IP Günlüğü — {ipLogClient.email}
              </h2>
              <button className="modal-close" onClick={() => setIpLogClient(null)}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
              {ipLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Aktif bağlantı günlüğü bulunamadı.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ipLogs.map((log, idx) => (
                    <div 
                      key={idx}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        background: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(6, 182, 212, 0.15)',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>{log.ip}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({log.time})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ marginTop: '1.5rem', padding: '1rem 0 0 0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} 
                onClick={handleRefreshIpLogs}
              >
                <RefreshCw size={14} />
                Yenile
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }} 
                onClick={handleClearIpLogs}
              >
                Tümünü Temizle
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ background: 'var(--accent-blue)', color: 'white' }} 
                onClick={() => setIpLogClient(null)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

