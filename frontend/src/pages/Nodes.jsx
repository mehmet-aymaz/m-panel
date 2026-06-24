import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { Server, Plus, Edit2, Trash2, RefreshCw, Wifi, WifiOff, Cpu, HardDrive, Database, AlertCircle, CheckCircle, Key } from 'lucide-react';

export default function Nodes() {
  const { t, showToast, confirm } = useSettings();
  const [nodes, setNodes] = useState([]);
  const [nodeStats, setNodeStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testingNodeId, setTestingNodeId] = useState(null);
  const [syncingNodeId, setSyncingNodeId] = useState(null);
  const [modalError, setModalError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [nodeId, setNodeId] = useState(null);
  
  // Form states
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authMethod, setAuthMethod] = useState('password'); // password or ssh_key
  const [password, setPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [xrayConfigPath, setXrayConfigPath] = useState('/usr/local/etc/xray/config.json');
  const [panelPort, setPanelPort] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Fetch node stats in background
  const fetchStats = async (id) => {
    try {
      const stats = await api.getNodeStats(id);
      setNodeStats(prev => ({ ...prev, [id]: stats }));
    } catch (err) {
      console.error(`Error fetching stats for node ${id}:`, err);
    }
  };

  const fetchNodes = async () => {
    try {
      const data = await api.getNodes();
      setNodes(data);
      // Fetch stats for all active nodes in background
      data.forEach(node => {
        if (node.is_active) {
          fetchStats(node.id);
        }
      });
    } catch (err) {
      showToast(err.message || 'Düğümler yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(() => {
      nodes.forEach(node => {
        if (node.is_active) {
          fetchStats(node.id);
        }
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [nodes.length]);

  // Toggle body class for modal z-index/blur
  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isModalOpen]);

  const handleOpenAddModal = () => {
    setEditMode(false);
    setNodeId(null);
    setName('');
    setHost('');
    setPort(22);
    setUsername('root');
    setAuthMethod('password');
    setPassword('');
    setSshKey('');
    setXrayConfigPath('/usr/local/etc/xray/config.json');
    setPanelPort('');
    setIsActive(true);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node) => {
    setEditMode(true);
    setNodeId(node.id);
    setName(node.name);
    setHost(node.host);
    setPort(node.port || 22);
    setUsername(node.username || 'root');
    setAuthMethod(node.ssh_key ? 'ssh_key' : 'password');
    setPassword('');
    setSshKey('');
    setXrayConfigPath(node.xray_config_path || '/usr/local/etc/xray/config.json');
    setPanelPort(node.panel_port ? node.panel_port.toString() : '');
    setIsActive(node.is_active);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!name.trim() || !host.trim()) {
      setModalError('Lütfen ad ve sunucu adresini doldurun.');
      return;
    }

    setActionLoading(true);
    const payload = {
      name,
      host,
      port: parseInt(port),
      username,
      xray_config_path: xrayConfigPath,
      panel_port: panelPort ? parseInt(panelPort) : null,
      is_active: isActive
    };

    if (authMethod === 'password' && password) {
      payload.password = password;
      payload.ssh_key = null;
    } else if (authMethod === 'ssh_key' && sshKey) {
      payload.ssh_key = sshKey;
      payload.password = null;
    }

    try {
      if (editMode) {
        await api.updateNode(nodeId, payload);
        showToast('Düğüm başarıyla güncellendi.', 'success');
      } else {
        await api.createNode(payload);
        showToast('Düğüm başarıyla eklendi.', 'success');
      }
      setIsModalOpen(false);
      fetchNodes();
    } catch (err) {
      setModalError(err.message || 'Düğüm kaydedilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (node) => {
    if (node.id === 1) {
      showToast('Ana düğüm (Local Node) silinemez.', 'error');
      return;
    }
    const confirmed = await confirm(t('nodes_confirm_delete') || 'Bu düğümü silmek istediğinizden emin misiniz?');
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await api.deleteNode(node.id);
      showToast('Düğüm silindi.', 'success');
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
      showToast(err.message || 'Bağlantı testi sırasında hata oluştu.', 'error');
    } finally {
      setTestingNodeId(null);
    }
  };

  const handleSyncConfig = async (node) => {
    setSyncingNodeId(node.id);
    try {
      const res = await api.syncNode(node.id);
      if (res.success) {
        showToast(`${node.name}: ${t('nodes_sync_success') || 'Config başarıyla gönderildi'}`, 'success');
      } else {
        showToast(`${node.name}: Config gönderilemedi.`, 'error');
      }
    } catch (err) {
      showToast(err.message || 'Config gönderimi sırasında hata oluştu.', 'error');
    } finally {
      setSyncingNodeId(null);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', margin: 0 }}>
            <Server size={20} style={{ color: 'var(--accent-cyan)' }} />
            {t('nodes_title') || 'Düğümler'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            {t('nodes_desc') || 'Xray inbounds barındıran sunucuları ve düğümleri yönetin.'}
          </p>
        </div>
        <button className="btn-primary" onClick={handleOpenAddModal} disabled={actionLoading}>
          <Plus size={16} style={{ marginRight: '5px' }} /> {t('nodes_add') || 'Node Ekle'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <div className="brand-icon animate-spin" style={{ width: '40px', height: '40px' }}>M</div>
          <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>{t('loading')}</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {nodes.map(node => {
            const stats = nodeStats[node.id];
            const isTesting = testingNodeId === node.id;
            const isSyncing = syncingNodeId === node.id;
            const isLocal = node.id === 1;

            return (
              <div key={node.id} className="glass-card glow-cyan animate-fade-in" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', gap: '1rem', position: 'relative' }}>
                
                {/* Node Title Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {node.name}
                      {isLocal && (
                        <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', fontSize: '0.7rem' }}>Lokal</span>
                      )}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {node.host}:{node.port}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {node.is_active ? (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Wifi size={12} /> {t('nodes_active') || 'Aktif'}
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <WifiOff size={12} /> {t('nodes_inactive') || 'Pasif'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Telemetry Resource Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  {!node.is_active ? (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {t('nodes_inactive') || 'Pasif Düğüm'}
                    </div>
                  ) : stats ? (
                    <>
                      {/* CPU Usage */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '500' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                            <Cpu size={14} /> CPU
                          </span>
                          <span style={{ color: 'var(--text-primary)' }}>{Math.round(stats.cpu_usage || stats.cpu || 0)}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, Math.round(stats.cpu_usage || stats.cpu || 0))}%`, 
                            height: '100%', 
                            background: 'var(--accent-cyan)', 
                            borderRadius: '3px',
                            transition: 'width 0.4s ease'
                          }}></div>
                        </div>
                      </div>

                      {/* Memory Usage */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '500' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                            <Database size={14} /> RAM
                          </span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {Math.round(stats.memory?.percent || 0)}% ({formatBytes(stats.memory?.used)} / {formatBytes(stats.memory?.total)})
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, Math.round(stats.memory?.percent || 0))}%`, 
                            height: '100%', 
                            background: 'var(--accent-purple)', 
                            borderRadius: '3px',
                            transition: 'width 0.4s ease'
                          }}></div>
                        </div>
                      </div>

                      {/* Disk Usage */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '500' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                            <HardDrive size={14} /> Disk
                          </span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {Math.round(stats.disk?.percent || 0)}% ({formatBytes(stats.disk?.used)} / {formatBytes(stats.disk?.total)})
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, Math.round(stats.disk?.percent || 0))}%`, 
                            height: '100%', 
                            background: 'var(--accent-blue)', 
                            borderRadius: '3px',
                            transition: 'width 0.4s ease'
                          }}></div>
                        </div>
                      </div>

                      {/* Extra stats */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem' }}>
                        <span>{t('nodes_xray_status') || 'Xray Durumu'}: 
                          <span style={{ color: stats.xray_running ? 'var(--success)' : 'var(--danger)', marginLeft: '3px', fontWeight: '600' }}>
                            {stats.xray_running ? 'Running' : 'Stopped'}
                          </span>
                        </span>
                        {node.last_seen && (
                          <span>
                            {t('nodes_last_seen') || 'Son Görülme'}: {new Date(node.last_seen).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-muted)', fontSize: '0.8rem', gap: '0.5rem' }}>
                      <RefreshCw size={14} className="animate-spin" />
                      {t('nodes_testing') || 'İstatistikler yükleniyor...'}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem', flexWrap: 'wrap' }}>
                  <button 
                    className="btn-secondary" 
                    style={{ flex: 1, minWidth: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    onClick={() => handleTestConnection(node)}
                    disabled={isTesting || actionLoading}
                  >
                    <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
                    {t('nodes_test') || 'Test'}
                  </button>

                  <button 
                    className="btn-secondary" 
                    style={{ flex: 1, minWidth: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    onClick={() => handleSyncConfig(node)}
                    disabled={isSyncing || actionLoading}
                  >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                    {t('nodes_sync') || 'Gönder'}
                  </button>

                  <button 
                    className="btn-icon" 
                    onClick={() => handleOpenEditModal(node)}
                    disabled={actionLoading}
                    title={t('edit')}
                  >
                    <Edit2 size={14} />
                  </button>

                  {!isLocal && (
                    <button 
                      className="btn-icon delete" 
                      onClick={() => handleDelete(node)}
                      disabled={actionLoading}
                      title={t('delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Node Modal */}
      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editMode ? t('nodes_edit') || 'Düğüm Düzenle' : t('nodes_add') || 'Düğüm Ekle'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>×</button>
            </div>

            {modalError && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Server Name & Host Address */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-name">{t('nodes_name') || 'Düğüm Adı'}</label>
                    <input
                      id="node-name"
                      type="text"
                      className="form-input"
                      placeholder="örn. Almanya-1"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={actionLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-host">{t('nodes_host') || 'Sunucu Adresi (IP/Domain)'}</label>
                    <input
                      id="node-host"
                      type="text"
                      className="form-input"
                      placeholder="örn. 192.168.1.100"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      required
                      disabled={actionLoading}
                    />
                  </div>
                </div>

                {/* Username & Port */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-username">{t('nodes_username') || 'SSH Kullanıcısı'}</label>
                    <input
                      id="node-username"
                      type="text"
                      className="form-input"
                      placeholder="root"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={actionLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-port">{t('nodes_port') || 'SSH Portu'}</label>
                    <input
                      id="node-port"
                      type="number"
                      className="form-input"
                      placeholder="22"
                      value={port}
                      onChange={(e) => setPort(parseInt(e.target.value) || 22)}
                      disabled={actionLoading}
                    />
                  </div>
                </div>

                {/* Auth Method */}
                <div className="form-group">
                  <label className="form-label">{t('nodes_auth_method') || 'SSH Kimlik Doğrulama'}</label>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      <input 
                        type="radio" 
                        name="authMethod" 
                        value="password" 
                        checked={authMethod === 'password'} 
                        onChange={() => setAuthMethod('password')}
                        disabled={actionLoading}
                      />
                      {t('nodes_auth_password') || 'Şifre'}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      <input 
                        type="radio" 
                        name="authMethod" 
                        value="ssh_key" 
                        checked={authMethod === 'ssh_key'} 
                        onChange={() => setAuthMethod('ssh_key')}
                        disabled={actionLoading}
                      />
                      {t('nodes_auth_ssh_key') || 'SSH Key (Private Key)'}
                    </label>
                  </div>
                </div>

                {/* Password / SSH Key details */}
                {authMethod === 'password' ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-password">{t('nodes_password') || 'Şifre'}</label>
                    <input
                      id="node-password"
                      type="password"
                      className="form-input"
                      placeholder={editMode ? 'Değiştirmek istemiyorsanız boş bırakın' : 'SSH bağlantı şifresi'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!editMode}
                      disabled={actionLoading}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-sshkey">{t('nodes_ssh_key') || 'SSH Private Key'}</label>
                    <textarea
                      id="node-sshkey"
                      className="form-input"
                      rows={5}
                      style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      placeholder={editMode ? 'Değiştirmek istemiyorsanız boş bırakın\n-----BEGIN OPENSSH PRIVATE KEY-----...' : '-----BEGIN OPENSSH PRIVATE KEY-----\n...'}
                      value={sshKey}
                      onChange={(e) => setSshKey(e.target.value)}
                      required={!editMode}
                      disabled={actionLoading}
                    />
                  </div>
                )}

                {/* Xray Config Path & Panel Port */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-config-path">{t('nodes_xray_config_path') || 'Xray Config Dosya Yolu'}</label>
                    <input
                      id="node-config-path"
                      type="text"
                      className="form-input"
                      placeholder="/usr/local/etc/xray/config.json"
                      value={xrayConfigPath}
                      onChange={(e) => setXrayConfigPath(e.target.value)}
                      disabled={actionLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="node-panel-port">{t('nodes_panel_port') || 'Panel Portu (Opsiyonel)'}</label>
                    <input
                      id="node-panel-port"
                      type="number"
                      className="form-input"
                      placeholder="8443"
                      value={panelPort}
                      onChange={(e) => setPanelPort(e.target.value)}
                      disabled={actionLoading}
                    />
                  </div>
                </div>

                {/* Active Checkbox */}
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    id="node-active"
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={actionLoading}
                  />
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
