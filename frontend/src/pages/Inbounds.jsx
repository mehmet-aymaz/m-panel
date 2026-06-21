import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function Inbounds() {
  const { t, confirm } = useSettings();
  const [inbounds, setInbounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('basics');
  
  // Form states
  const [editMode, setEditMode] = useState(false);
  const [inboundId, setInboundId] = useState(null);
  const [remark, setRemark] = useState('');
  const [protocol, setProtocol] = useState('vless');
  const [port, setPort] = useState('');
  const [enable, setEnable] = useState(true);
  
  // Extended fields
  const [network, setNetwork] = useState('ws');
  const [security, setSecurity] = useState('tls');
  const [sni, setSni] = useState('');
  const [wsPath, setWsPath] = useState('/');
  const [wsHost, setWsHost] = useState('');
  const [sniffingEnabled, setSniffingEnabled] = useState(true);
  const [grpcServiceName, setGrpcServiceName] = useState('');
  
  // Advanced raw settings
  const [settings, setSettings] = useState('');
  const [streamSettings, setStreamSettings] = useState('');

  const { setHeaderStats } = useOutletContext();

  useEffect(() => {
    if (!inbounds) return;
    
    const total = inbounds.length;
    const active = inbounds.filter(i => i.enable).length;
    const disabled = inbounds.filter(i => !i.enable).length;
    
    setHeaderStats({
      type: 'inbounds',
      total,
      active,
      disabled
    });
    
    return () => setHeaderStats(null);
  }, [inbounds, setHeaderStats]);

  const fetchInbounds = async () => {
    try {
      const data = await api.getInbounds();
      setInbounds(data);
      setError('');
    } catch (err) {
      setError(err.message || t('error_conn'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbounds();
  }, []);

  // Toggle body class for modal state to allow hiding header panel and increasing blur
  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isModalOpen]);


  const formatTraffic = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleOpenAddModal = () => {
    setEditMode(false);
    setInboundId(null);
    setRemark('');
    setProtocol('vless');
    setPort('');
    setEnable(true);
    
    // Reset extended fields
    setNetwork('ws');
    setSecurity('tls');
    setSni('');
    setWsPath('/');
    setWsHost('');
    setSniffingEnabled(true);
    setGrpcServiceName('');

    setSettings(JSON.stringify({ clients: [] }, null, 2));
    setStreamSettings('');
    setModalError('');
    setActiveTab('basics');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (inbound) => {
    setEditMode(true);
    setInboundId(inbound.id);
    setRemark(inbound.remark || '');
    setProtocol(inbound.protocol);
    setPort(inbound.port.toString());
    setEnable(inbound.enable);
    
    // Set extended fields
    setNetwork(inbound.network || 'ws');
    setSecurity(inbound.security || 'tls');
    setSni(inbound.sni || '');
    setWsPath(inbound.ws_path || '/');
    setWsHost(inbound.ws_host || '');
    setSniffingEnabled(inbound.sniffing_enabled);
    setGrpcServiceName(inbound.grpc_service_name || '');

    // Pretty print settings JSON
    try {
      const parsedSettings = inbound.settings ? JSON.parse(inbound.settings) : {};
      setSettings(JSON.stringify(parsedSettings, null, 2));
    } catch (e) {
      setSettings(inbound.settings || '');
    }

    try {
      const parsedStream = inbound.stream_settings ? JSON.parse(inbound.stream_settings) : {};
      setStreamSettings(JSON.stringify(parsedStream, null, 2));
    } catch (e) {
      setStreamSettings(inbound.stream_settings || '');
    }

    setModalError('');
    setActiveTab('basics');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    // Validation: gRPC needs service name
    if (network === 'grpc' && !grpcServiceName.trim()) {
      setModalError('gRPC network protokolü için Service Name alanı zorunludur.');
      return;
    }

    setActionLoading(true);

    // Validate JSON fields if not empty
    let parsedSettings = "";
    if (settings.trim()) {
      try {
        JSON.parse(settings);
        parsedSettings = settings;
      } catch (err) {
        setModalError('Settings alanı geçerli bir JSON olmalıdır.');
        setActionLoading(false);
        return;
      }
    }

    let parsedStream = "";
    if (streamSettings.trim()) {
      try {
        JSON.parse(streamSettings);
        parsedStream = streamSettings;
      } catch (err) {
        setModalError('Stream Settings alanı geçerli bir JSON olmalıdır.');
        setActionLoading(false);
        return;
      }
    }

    const payload = {
      remark,
      protocol: protocol.toLowerCase(),
      port: parseInt(port),
      enable,
      network: network.toLowerCase(),
      security: security.toLowerCase(),
      sni: (security === 'tls' || security === 'reality') ? sni : null,
      ws_path: network === 'ws' ? wsPath : null,
      ws_host: network === 'ws' ? wsHost : null,
      sniffing_enabled: sniffingEnabled,
      grpc_service_name: network === 'grpc' ? grpcServiceName : null,
      settings: parsedSettings,
      stream_settings: parsedStream
    };

    try {
      if (editMode) {
        await api.updateInbound(inboundId, payload);
      } else {
        await api.createInbound(payload);
      }
      await fetchInbounds();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'İşlem gerçekleştirilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (inbound) => {
    setActionLoading(true);
    setError('');
    try {
      await api.toggleInbound(inbound.id);
      await fetchInbounds();
    } catch (err) {
      setError(err.message || 'Inbound durumu değiştirilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (inbound) => {
    if (!await confirm(`"${inbound.remark || inbound.port}" ${t('confirm_delete_inbound')}`)) {
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.deleteInbound(inbound.id);
      await fetchInbounds();
    } catch (err) {
      setError(err.message || 'Inbound silinemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {error && (
        <div className="error-banner animate-fade-in" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', alignItems: 'center', gap: '1rem' }}>
        {actionLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
            <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span>{t('applying')}</span>
          </div>
        )}
        <button className="btn-primary" onClick={handleOpenAddModal} disabled={actionLoading}>
          <Plus size={16} style={{ marginRight: '5px' }} /> {t('add_inbound')}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <div className="brand-icon" style={{ width: '32px', height: '32px', animation: 'spin 1.5s linear infinite' }}>M</div>
          <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>{t('loading')}</span>
        </div>
      ) : (
        <div className="table-container animate-fade-in">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('remark')}</th>
                <th>{t('protocol')}</th>
                <th>{t('port')}</th>
                <th>{t('stream')}</th>
                <th>{t('security')}</th>
                <th>{t('upload')} (Up)</th>
                <th>{t('download')} (Down)</th>
                <th>{t('client_count')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {inbounds.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    {t('no_inbounds')}
                  </td>
                </tr>
              ) : (
                inbounds.map((inbound) => (
                  <tr key={inbound.id}>
                    <td style={{ fontWeight: '600' }}>{inbound.remark || '-'}</td>
                    <td>
                      <span className="badge badge-info">{inbound.protocol.toUpperCase()}</span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{inbound.port}</td>
                    <td>
                      <span className="badge badge-info" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)' }}>
                        {inbound.network ? inbound.network.toUpperCase() : 'WS'}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        background: inbound.security === 'none' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                        color: inbound.security === 'none' ? 'var(--danger)' : 'var(--success)'
                      }}>
                        {inbound.security ? inbound.security.toUpperCase() : 'TLS'}
                      </span>
                    </td>
                    <td>{formatTraffic(inbound.up)}</td>
                    <td>{formatTraffic(inbound.down)}</td>
                    <td>
                      <span className="badge badge-info" style={{ borderRadius: '4px' }}>
                        {inbound.clients ? inbound.clients.length : 0} {t('total_clients')}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleToggle(inbound)} 
                        disabled={actionLoading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        title={t('status')}
                      >
                        {inbound.enable ? (
                          <span className="badge badge-success">
                            <CheckCircle size={10} style={{ marginRight: '3px' }} /> {t('active')}
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            <XCircle size={10} style={{ marginRight: '3px' }} /> {t('passive')}
                          </span>
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-icon" title={t('edit')} onClick={() => handleOpenEditModal(inbound)} disabled={actionLoading}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-icon delete" title={t('delete')} onClick={() => handleDelete(inbound)} disabled={actionLoading}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Inbound Modal */}
      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>{editMode ? t('edit_inbound') : t('add_inbound')}</h2>
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
                  className={`modal-tab-btn ${activeTab === 'protocol' ? 'active' : ''}`}
                  onClick={() => setActiveTab('protocol')}
                >
                  {t('tab_protocol')}
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'stream' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stream')}
                >
                  {t('tab_stream')}
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                  onClick={() => setActiveTab('security')}
                >
                  {t('tab_security')}
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'basics' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '340px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-remark">{t('remark')}</label>
                      <input
                        id="modal-remark"
                        type="text"
                        className="form-input"
                        placeholder="örn. TR-VLESS-443"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        required
                        disabled={actionLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-port">{t('port')}</label>
                      <input
                        id="modal-port"
                        type="number"
                        className="form-input"
                        placeholder="örn. 8443"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        required
                        disabled={actionLoading}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-protocol">{t('protocol')}</label>
                      <select
                        id="modal-protocol"
                        className="form-input"
                        value={protocol}
                        onChange={(e) => setProtocol(e.target.value)}
                        disabled={actionLoading || editMode}
                      >
                        <option value="vless">VLESS</option>
                        <option value="vmess">VMess</option>
                        <option value="trojan">Trojan</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1.75rem' }}>
                      <input
                        id="modal-enable"
                        type="checkbox"
                        checked={enable}
                        onChange={(e) => setEnable(e.target.checked)}
                        disabled={actionLoading}
                      />
                      <label className="form-label" htmlFor="modal-enable" style={{ cursor: 'pointer' }}>{t('active')}</label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'protocol' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '340px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="modal-settings">{t('inbound_listen')} / {t('tab_protocol')}</label>
                    <textarea
                      id="modal-settings"
                      className="form-input"
                      rows={8}
                      style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                      value={settings}
                      onChange={(e) => setSettings(e.target.value)}
                      disabled={actionLoading}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'stream' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '340px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-network">{t('stream')}</label>
                      <select
                        id="modal-network"
                        className="form-input"
                        value={network}
                        onChange={(e) => setNetwork(e.target.value)}
                        disabled={actionLoading}
                      >
                        <option value="ws">WS (WebSocket)</option>
                        <option value="tcp">TCP</option>
                        <option value="grpc">gRPC</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1.75rem' }}>
                      <input
                        id="modal-sniffing"
                        type="checkbox"
                        checked={sniffingEnabled}
                        onChange={(e) => setSniffingEnabled(e.target.checked)}
                        disabled={actionLoading}
                      />
                      <label className="form-label" htmlFor="modal-sniffing" style={{ cursor: 'pointer' }}>Traffic Sniffing</label>
                    </div>
                  </div>

                  {network === 'ws' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="modal-wspath">{t('path')}</label>
                        <input
                          id="modal-wspath"
                          type="text"
                          className="form-input"
                          placeholder="/"
                          value={wsPath}
                          onChange={(e) => setWsPath(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="modal-wshost">{t('ws_host')}</label>
                        <input
                          id="modal-wshost"
                          type="text"
                          className="form-input"
                          placeholder="örn. panel.mehmetaymaz.com.tr"
                          value={wsHost}
                          onChange={(e) => setWsHost(e.target.value)}
                          disabled={actionLoading}
                        />
                      </div>
                    </div>
                  )}

                  {network === 'grpc' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-grpcname">{t('grpc_service')}</label>
                      <input
                        id="modal-grpcname"
                        type="text"
                        className="form-input"
                        placeholder="örn. MyGRPCService"
                        value={grpcServiceName}
                        onChange={(e) => setGrpcServiceName(e.target.value)}
                        disabled={actionLoading}
                      />
                    </div>
                  )}

                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label" htmlFor="modal-stream">Stream Settings JSON</label>
                    <textarea
                      id="modal-stream"
                      className="form-input"
                      rows={4}
                      style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      value={streamSettings}
                      onChange={(e) => setStreamSettings(e.target.value)}
                      placeholder="Ekstra JSON özellikleri..."
                      disabled={actionLoading}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '340px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="modal-security">{t('security')}</label>
                    <select
                      id="modal-security"
                      className="form-input"
                      value={security}
                      onChange={(e) => setSecurity(e.target.value)}
                      disabled={actionLoading}
                    >
                      <option value="tls">TLS</option>
                      <option value="reality">Reality</option>
                      <option value="none">None</option>
                    </select>
                  </div>

                  {(security === 'tls' || security === 'reality') && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="modal-sni">SNI (Server Name Indication)</label>
                      <input
                        id="modal-sni"
                        type="text"
                        className="form-input"
                        placeholder="örn. c.whatsapp.net"
                        value={sni}
                        onChange={(e) => setSni(e.target.value)}
                        disabled={actionLoading}
                      />
                    </div>
                  )}
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
    </div>
  );
}
