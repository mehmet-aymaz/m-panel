import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function Inbounds() {
  const [inbounds, setInbounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form states
  const [editMode, setEditMode] = useState(false);
  const [inboundId, setInboundId] = useState(null);
  const [remark, setRemark] = useState('');
  const [protocol, setProtocol] = useState('vless');
  const [port, setPort] = useState('');
  const [enable, setEnable] = useState(true);
  const [settings, setSettings] = useState('');
  const [streamSettings, setStreamSettings] = useState('');

  const fetchInbounds = async () => {
    try {
      const data = await api.getInbounds();
      setInbounds(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Inbound listesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbounds();
  }, []);

  const formatTraffic = (bytes) => {
    if (bytes === 0) return 'Sınırsız';
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatExpiry = (timestamp) => {
    if (timestamp === 0) return 'Sınırsız';
    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR');
  };

  const handleOpenAddModal = () => {
    setEditMode(false);
    setInboundId(null);
    setRemark('');
    setProtocol('vless');
    setPort('');
    setEnable(true);
    setSettings(JSON.stringify({ clients: [] }, null, 2));
    setStreamSettings(JSON.stringify({
      network: "tcp",
      security: "none"
    }, null, 2));
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (inbound) => {
    setEditMode(true);
    setInboundId(inbound.id);
    setRemark(inbound.remark || '');
    setProtocol(inbound.protocol);
    setPort(inbound.port.toString());
    setEnable(inbound.enable);
    
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
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
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
    if (!window.confirm(`"${inbound.remark || inbound.port}" inbound bağlantısını ve bu porta bağlı TÜM kullanıcıları silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz!`)) {
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', alignItems: 'center', gap: '1rem' }}>
        {actionLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
            <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span>Yapılandırma Xray\'e uygulanıyor...</span>
          </div>
        )}
        <button className="btn-primary" onClick={handleOpenAddModal} disabled={actionLoading}>
          <Plus size={16} style={{ marginRight: '5px' }} /> Yeni Inbound Ekle
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <div className="brand-icon" style={{ width: '32px', height: '32px', animation: 'spin 1.5s linear infinite' }}>M</div>
          <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Yükleniyor...</span>
        </div>
      ) : (
        <div className="table-container animate-fade-in">
          <table className="data-table">
            <thead>
              <tr>
                <th>Remark</th>
                <th>Protokol</th>
                <th>Port</th>
                <th>Yükleme (Up)</th>
                <th>İndirme (Down)</th>
                <th>Sınır (Total)</th>
                <th>Süre</th>
                <th>Kullanıcılar</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {inbounds.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Kayıtlı inbound bağlantısı bulunmuyor. Yeni bir tane ekleyerek başlayın.
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
                    <td>{formatTraffic(inbound.up)}</td>
                    <td>{formatTraffic(inbound.down)}</td>
                    <td>{formatTraffic(inbound.total)}</td>
                    <td>{formatExpiry(inbound.expiry_time)}</td>
                    <td>
                      <span className="badge badge-info" style={{ borderRadius: '4px' }}>
                        {inbound.clients ? inbound.clients.length : 0} Kullanıcı
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleToggle(inbound)} 
                        disabled={actionLoading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        title="Durumu Değiştir"
                      >
                        {inbound.enable ? (
                          <span className="badge badge-success">
                            <CheckCircle size={10} style={{ marginRight: '3px' }} /> Aktif
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            <XCircle size={10} style={{ marginRight: '3px' }} /> Pasif
                          </span>
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-icon" title="Düzenle" onClick={() => handleOpenEditModal(inbound)} disabled={actionLoading}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-icon delete" title="Sil" onClick={() => handleDelete(inbound)} disabled={actionLoading}>
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
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editMode ? 'Inbound Yapılandırmasını Düzenle' : 'Yeni Inbound Ekle'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>×</button>
            </div>
            
            {modalError && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-remark">Açıklama (Remark)</label>
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
                  <label className="form-label" htmlFor="modal-port">Port</label>
                  <input
                    id="modal-port"
                    type="number"
                    className="form-input"
                    placeholder="örn. 443"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    required
                    disabled={actionLoading}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-protocol">Protokol</label>
                  <select
                    id="modal-protocol"
                    className="form-input"
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    disabled={actionLoading || editMode} // Disable protocol edit after creation
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
                  <label className="form-label" htmlFor="modal-enable" style={{ cursor: 'pointer' }}>Aktif / Çalışıyor</label>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label" htmlFor="modal-settings">İnce Ayarlar (Settings JSON)</label>
                <textarea
                  id="modal-settings"
                  className="form-input"
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  value={settings}
                  onChange={(e) => setSettings(e.target.value)}
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-stream">Yayın Ayarları (Stream Settings JSON)</label>
                <textarea
                  id="modal-stream"
                  className="form-input"
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  value={streamSettings}
                  onChange={(e) => setStreamSettings(e.target.value)}
                  disabled={actionLoading}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>İptal</button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Xray\'e Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
