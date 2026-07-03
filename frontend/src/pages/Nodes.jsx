import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import {
  Server, Plus, Edit2, Trash2, RefreshCw, Wifi, WifiOff,
  Cpu, HardDrive, Database, AlertCircle, CheckCircle, Key,
  Globe, ExternalLink, ShieldCheck
} from 'lucide-react';

export default function Nodes() {
  const { t, showToast, confirm } = useSettings();
  const navigate = useNavigate();

  const [nodes, setNodes] = useState([]);
  const [nodeStats, setNodeStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testingNodeId, setTestingNodeId] = useState(null);
  const [syncingNodeId, setSyncingNodeId] = useState(null);
  const [modalError, setModalError] = useState('');
  const [testResult, setTestResult] = useState(null); // modal içi test sonucu

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [nodeId, setNodeId] = useState(null);

  // Ortak form
  const [name, setName] = useState('');
  const [nodeType, setNodeType] = useState('ssh'); // 'ssh' | 'xui_api'
  const [isActive, setIsActive] = useState(true);

  // SSH form alanları
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authMethod, setAuthMethod] = useState('password');
  const [password, setPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [xrayConfigPath, setXrayConfigPath] = useState('/usr/local/etc/xray/config.json');
  const [panelPort, setPanelPort] = useState('');

  // 3x-ui form alanları
  const [xuiUrl, setXuiUrl] = useState('');
  const [xuiUsername, setXuiUsername] = useState('');
  const [xuiPassword, setXuiPassword] = useState('');

  // ─── Stats fetch ────────────────────────────────────────────────────────────
  const fetchStats = async (id) => {
    try {
      const stats = await api.getNodeStats(id);
      setNodeStats(prev => ({ ...prev, [id]: stats }));
    } catch (_) {}
  };

  const fetchNodes = async () => {
    try {
      const data = await api.getNodes();
      setNodes(data);
      data.forEach(node => { if (node.is_active) fetchStats(node.id); });
    } catch (err) {
      showToast(err.message || 'Düğümler yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(() => {
      nodes.forEach(node => { if (node.is_active) fetchStats(node.id); });
    }, 15000);
    return () => clearInterval(interval);
  }, [nodes.length]);

  useEffect(() => {
    if (isModalOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [isModalOpen]);

  // ─── Modal helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setName(''); setNodeType('ssh'); setIsActive(true);
    setHost(''); setPort(22); setUsername('root');
    setAuthMethod('password'); setPassword(''); setSshKey('');
    setXrayConfigPath('/usr/local/etc/xray/config.json'); setPanelPort('');
    setXuiUrl(''); setXuiUsername(''); setXuiPassword('');
    setModalError(''); setTestResult(null);
  };

  const handleOpenAddModal = () => {
    setEditMode(false); setNodeId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node) => {
    setEditMode(true); setNodeId(node.id);
    setName(node.name);
    setNodeType(node.node_type || 'ssh');
    setIsActive(node.is_active);

    // SSH
    setHost(node.host || '');
    setPort(node.port || 22);
    setUsername(node.username || 'root');
    setAuthMethod(node.ssh_key ? 'ssh_key' : 'password');
    setPassword(''); setSshKey('');
    setXrayConfigPath(node.xray_config_path || '/usr/local/etc/xray/config.json');
    setPanelPort(node.panel_port ? node.panel_port.toString() : '');

    // 3x-ui
    setXuiUrl(node.url || '');
    setXuiUsername(node.xui_username || '');
    setXuiPassword(''); // şifre döndürülmez

    setModalError(''); setTestResult(null);
    setIsModalOpen(true);
  };

  // ─── Modal içi bağlantı testi (3x-ui ve SSH) ───────────────────────────
  const handleModalTest = async () => {
    setModalError('');
    
    if (nodeType === 'xui_api') {
      if (!xuiUrl || !xuiUsername) {
        setModalError('Panel URL ve kullanıcı adı gereklidir.');
        return;
      }
      if (!editMode && !xuiPassword) {
        setModalError('Şifre gereklidir.');
        return;
      }
    } else {
      if (!host) {
        setModalError('Sunucu adresi gereklidir.');
        return;
      }
    }

    setTestResult(null);
    setActionLoading(true);
    
    try {
      const payload = {
        node_type: nodeType,
        host,
        port: parseInt(port) || 22,
        username,
        password: authMethod === 'password' ? password : sshKey,
        url: xuiUrl,
        xui_username: xuiUsername,
        xui_password: xuiPassword
      };
      
      const res = await api.testNodeDirect(payload);
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Form submit ─────────────────────────────────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!name.trim()) { setModalError('Düğüm adı zorunludur.'); return; }

    if (nodeType === 'xui_api') {
      if (!xuiUrl.trim()) { setModalError('Panel URL zorunludur.'); return; }
      if (!xuiUsername.trim()) { setModalError('Kullanıcı adı zorunludur.'); return; }
      if (!editMode && !xuiPassword) { setModalError('Şifre zorunludur.'); return; }
    } else {
      if (!host.trim()) { setModalError('Sunucu adresi zorunludur.'); return; }
    }

    setActionLoading(true);

    let payload = { name, node_type: nodeType, is_active: isActive };

    if (nodeType === 'xui_api') {
      payload.url = xuiUrl;
      payload.xui_username = xuiUsername;
      if (xuiPassword) payload.xui_password = xuiPassword;
      payload.host = 'localhost'; // zorunlu alan için fallback
    } else {
      payload.host = host;
      payload.port = parseInt(port);
      payload.username = username;
      payload.xray_config_path = xrayConfigPath;
      payload.panel_port = panelPort ? parseInt(panelPort) : null;
      if (authMethod === 'password' && password) { payload.password = password; }
      else if (authMethod === 'ssh_key' && sshKey) { payload.ssh_key = sshKey; }
    }

    try {
      if (editMode) {
        await api.updateNode(nodeId, payload);
        showToast(t('nodes_updated') || 'Düğüm güncellendi.', 'success');
      } else {
        await api.createNode(payload);
        showToast(t('nodes_created') || 'Düğüm eklendi.', 'success');
      }
      setIsModalOpen(false);
      fetchNodes();
    } catch (err) {
      setModalError(err.message || 'Düğüm kaydedilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Diğer aksiyonlar ────────────────────────────────────────────────────────
  const handleDelete = async (node) => {
    if (node.id === 1) { showToast('Ana düğüm silinemez.', 'error'); return; }
    const ok = await confirm(t('nodes_confirm_delete') || 'Bu düğümü silmek istiyor musunuz?');
    if (!ok) return;
    setActionLoading(true);
    try {
      await api.deleteNode(node.id);
      showToast(t('nodes_deleted') || 'Düğüm silindi.', 'success');
      fetchNodes();
    } catch (err) {
      showToast(err.message || 'Düğüm silinemedi.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestConnection = async (node) => {
    setTestingNodeId(node.id);
    try {
      const res = await api.testNode(node.id);
      if (res.success) {
        showToast(`${node.name}: ${t('nodes_connection_success') || 'Bağlantı başarılı'} (${res.latency_ms || 0}ms)`, 'success');
        fetchStats(node.id);
      } else {
        showToast(`${node.name}: ${t('nodes_connection_failed') || 'Bağlantı başarısız'}: ${res.error || ''}`, 'error');
      }
    } catch (err) {
      showToast(err.message || 'Bağlantı testi sırasında hata.', 'error');
    } finally {
      setTestingNodeId(null);
    }
  };

  const handleSyncConfig = async (node) => {
    setSyncingNodeId(node.id);
    try {
      const res = await api.syncNode(node.id);
      if (res.success) showToast(`${node.name}: ${t('nodes_sync_success') || 'Config gönderildi'}`, 'success');
    } catch (err) {
      showToast(err.message || 'Config gönderimi başarısız.', 'error');
    } finally {
      setSyncingNodeId(null);
    }
  };

  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>

      {/* Header */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', margin: 0 }}>
            <Server size={20} style={{ color: 'var(--accent-cyan)' }} />
            {t('nodes_title') || 'Sunucular'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', margin: '0.25rem 0 0' }}>
            {t('nodes_desc') || 'SSH ve 3x-ui API tabanlı uzak sunucuları yönetin.'}
          </p>
        </div>
        <button className="btn-primary" onClick={handleOpenAddModal} disabled={actionLoading}>
          <Plus size={16} style={{ marginRight: '5px' }} />
          {t('nodes_add') || 'Sunucu Ekle'}
        </button>
      </div>

      {/* Node Cards */}
      {loading ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <div className="brand-icon animate-spin" style={{ width: '40px', height: '40px' }}>M</div>
          <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>{t('loading')}</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1.5rem' }}>
          {nodes.map(node => {
            const stats = nodeStats[node.id];
            const isTesting = testingNodeId === node.id;
            const isSyncing = syncingNodeId === node.id;
            const isLocal = node.id === 1;
            const isXui = (node.node_type === 'xui_api');

            return (
              <div key={node.id} className="glass-card glow-cyan animate-fade-in"
                style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', gap: '1rem', position: 'relative' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {node.name}
                      {isLocal && (
                        <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: 'var(--accent-cyan)', fontSize: '0.68rem' }}>Lokal</span>
                      )}
                      <span className="badge" style={{
                        background: isXui ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.1)',
                        color: isXui ? 'var(--accent-purple)' : 'var(--success)',
                        fontSize: '0.68rem',
                        display: 'flex', alignItems: 'center', gap: '0.2rem'
                      }}>
                        {isXui ? <><Globe size={10} /> 3x-ui API</> : <><Key size={10} /> SSH</>}
                      </span>
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'block', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isXui ? (node.url || '—') : `${node.host || ''}:${node.port || 22}`}
                    </span>
                  </div>

                  <div>
                    {node.is_active ? (
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Wifi size={11} /> {t('nodes_active') || 'Aktif'}
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <WifiOff size={11} /> {t('nodes_inactive') || 'Pasif'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
                  {!node.is_active ? (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '110px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {t('nodes_inactive') || 'Pasif Düğüm'}
                    </div>
                  ) : stats ? (
                    <>
                      {/* CPU */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '500' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}><Cpu size={13} /> CPU</span>
                          <span style={{ color: 'var(--text-primary)' }}>{Math.round(stats.cpu_usage || stats.cpu || 0)}%</span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.round(stats.cpu_usage || stats.cpu || 0))}%`, height: '100%', background: 'var(--accent-cyan)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                      {/* RAM */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '500' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}><Database size={13} /> RAM</span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {Math.round(stats.memory?.percent || 0)}%
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                              ({formatBytes(stats.memory?.used_bytes || stats.memory?.used)} / {formatBytes(stats.memory?.total_bytes || stats.memory?.total)})
                            </span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.round(stats.memory?.percent || 0))}%`, height: '100%', background: 'var(--accent-purple)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                      {/* Disk */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '500' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}><HardDrive size={13} /> Disk</span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {Math.round(stats.disk?.percent || 0)}%
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                              ({formatBytes(stats.disk?.used_bytes || stats.disk?.used)} / {formatBytes(stats.disk?.total_bytes || stats.disk?.total)})
                            </span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.round(stats.disk?.percent || 0))}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                      {/* Footer bilgi */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem' }}>
                        <span>
                          {t('nodes_xray_status') || 'Xray'}:
                          <span style={{ color: stats.xray_running ? 'var(--success)' : 'var(--danger)', marginLeft: '3px', fontWeight: '600' }}>
                            {stats.xray_running ? 'Running' : 'Stopped'}
                          </span>
                        </span>
                        {node.last_seen && (
                          <span>{t('nodes_last_seen') || 'Son görülme'}: {new Date(node.last_seen).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '110px', color: 'var(--text-muted)', fontSize: '0.8rem', gap: '0.5rem' }}>
                      <RefreshCw size={13} className="animate-spin" />
                      {t('nodes_testing') || 'İstatistikler yükleniyor...'}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.45rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.85rem', flexWrap: 'wrap' }}>
                  {/* 3x-ui node: [Yönet] */}
                  {isXui && (
                    <button
                      className="btn-primary"
                      style={{ flex: 1, minWidth: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => navigate(`/nodes/${node.id}`)}
                      disabled={actionLoading}
                    >
                      <ExternalLink size={12} />
                      {t('nodes_manage') || 'Yönet'}
                    </button>
                  )}

                  {/* Test */}
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, minWidth: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    onClick={() => handleTestConnection(node)}
                    disabled={isTesting || actionLoading}
                  >
                    <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
                    {t('nodes_test') || 'Test'}
                  </button>

                  {/* SSH node: Sync */}
                  {!isXui && (
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, minWidth: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => handleSyncConfig(node)}
                      disabled={isSyncing || actionLoading}
                    >
                      <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                      {t('nodes_sync') || 'Gönder'}
                    </button>
                  )}

                  <button className="btn-icon" onClick={() => handleOpenEditModal(node)} disabled={actionLoading} title={t('edit')}>
                    <Edit2 size={14} />
                  </button>
                  {!isLocal && (
                    <button className="btn-icon delete" onClick={() => handleDelete(node)} disabled={actionLoading} title={t('delete')}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h2>{editMode ? (t('nodes_edit') || 'Düğüm Düzenle') : (t('nodes_add') || 'Sunucu Ekle')}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>×</button>
            </div>

            {modalError && (
              <div className="error-banner">
                <AlertCircle size={16} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Düğüm adı + Bağlantı türü */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-name">{t('nodes_name') || 'Düğüm Adı'}</label>
                    <input
                      id="node-name" type="text" className="form-input"
                      placeholder="örn. Almanya-1"
                      value={name} onChange={e => setName(e.target.value)}
                      required disabled={actionLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('nodes_node_type') || 'Bağlantı Türü'}</label>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                        <input type="radio" name="nodeType" value="ssh" checked={nodeType === 'ssh'} onChange={() => setNodeType('ssh')} disabled={actionLoading} />
                        <Key size={13} /> SSH
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                        <input type="radio" name="nodeType" value="xui_api" checked={nodeType === 'xui_api'} onChange={() => setNodeType('xui_api')} disabled={actionLoading} />
                        <Globe size={13} /> 3x-ui API
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3x-ui API alanları */}
                {nodeType === 'xui_api' && (
                  <>
                    <div className="form-group">
                      <label className="form-label" htmlFor="xui-url">{t('nodes_xui_url') || 'Panel URL'}</label>
                      <input
                        id="xui-url" type="url" className="form-input"
                        placeholder="https://wmehmet.web.tr:2053"
                        value={xuiUrl} onChange={e => setXuiUrl(e.target.value)}
                        required disabled={actionLoading}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="xui-username">{t('nodes_xui_username') || 'Kullanıcı Adı'}</label>
                        <input
                          id="xui-username" type="text" className="form-input"
                          placeholder="admin"
                          value={xuiUsername} onChange={e => setXuiUsername(e.target.value)}
                          required disabled={actionLoading}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="xui-password">{t('nodes_password') || 'Şifre'}</label>
                        <input
                          id="xui-password" type="password" className="form-input"
                          placeholder={editMode ? 'Değiştirmek istemiyorsanız boş bırakın' : '3x-ui şifresi'}
                          value={xuiPassword} onChange={e => setXuiPassword(e.target.value)}
                          required={!editMode} disabled={actionLoading}
                        />
                      </div>
                    </div>

                    {/* Bağlantı Testi (modal içi) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                        onClick={handleModalTest}
                        disabled={actionLoading}
                      >
                        <ShieldCheck size={14} />
                        {t('nodes_test_connection') || 'Bağlantıyı Test Et'}
                      </button>
                      {testResult && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.83rem',
                          color: testResult.success ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {testResult.success
                            ? <><CheckCircle size={14} /> {t('nodes_connection_success') || 'Bağlantı başarılı'} · 📶 {testResult.latency_ms}ms</>
                            : <><AlertCircle size={14} /> {t('nodes_connection_failed') || 'Bağlantı başarısız'}: {testResult.error}</>
                          }
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* SSH alanları */}
                {nodeType === 'ssh' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="node-host">{t('nodes_host') || 'Sunucu Adresi'}</label>
                        <input
                          id="node-host" type="text" className="form-input"
                          placeholder="192.168.1.100"
                          value={host} onChange={e => setHost(e.target.value)}
                          required disabled={actionLoading}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="node-port">{t('nodes_port') || 'SSH Portu'}</label>
                        <input
                          id="node-port" type="number" className="form-input"
                          placeholder="22"
                          value={port} onChange={e => setPort(parseInt(e.target.value) || 22)}
                          disabled={actionLoading}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="node-username">{t('nodes_ssh_user') || 'SSH Kullanıcısı'}</label>
                        <input
                          id="node-username" type="text" className="form-input"
                          placeholder="root"
                          value={username} onChange={e => setUsername(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('nodes_auth_method') || 'Kimlik Doğrulama'}</label>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            <input type="radio" name="authMethod" value="password" checked={authMethod === 'password'} onChange={() => setAuthMethod('password')} disabled={actionLoading} />
                            {t('nodes_auth_password') || 'Şifre'}
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            <input type="radio" name="authMethod" value="ssh_key" checked={authMethod === 'ssh_key'} onChange={() => setAuthMethod('ssh_key')} disabled={actionLoading} />
                            SSH Key
                          </label>
                        </div>
                      </div>
                    </div>

                    {authMethod === 'password' ? (
                      <div className="form-group">
                        <label className="form-label" htmlFor="node-password">{t('nodes_password') || 'SSH Şifre'}</label>
                        <input
                          id="node-password" type="password" className="form-input"
                          placeholder={editMode ? 'Değiştirmek istemiyorsanız boş bırakın' : 'SSH bağlantı şifresi'}
                          value={password} onChange={e => setPassword(e.target.value)}
                          required={!editMode} disabled={actionLoading}
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label" htmlFor="node-sshkey">{t('nodes_ssh_key') || 'SSH Private Key'}</label>
                        <textarea
                          id="node-sshkey" className="form-input" rows={4}
                          style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                          placeholder={editMode ? 'Değiştirmek istemiyorsanız boş bırakın' : '-----BEGIN OPENSSH PRIVATE KEY-----\n...'}
                          value={sshKey} onChange={e => setSshKey(e.target.value)}
                          required={!editMode} disabled={actionLoading}
                        />
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="node-config-path">{t('nodes_xray_config_path') || 'Xray Config Yolu'}</label>
                        <input
                          id="node-config-path" type="text" className="form-input"
                          placeholder="/usr/local/etc/xray/config.json"
                          value={xrayConfigPath} onChange={e => setXrayConfigPath(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="node-panel-port">{t('nodes_panel_port') || 'Panel Portu (Opsiyonel)'}</label>
                        <input
                          id="node-panel-port" type="number" className="form-input"
                          placeholder="8443"
                          value={panelPort} onChange={e => setPanelPort(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Aktif */}
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input id="node-active" type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} disabled={actionLoading} />
                  <label className="form-label" htmlFor="node-active" style={{ cursor: 'pointer', margin: 0 }}>
                    {t('active') || 'Etkin / Düğüm Trafiğe Açık'}
                  </label>
                </div>

              </div>

              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
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
    </div>
  );
}
