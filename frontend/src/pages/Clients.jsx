import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Info, RefreshCw, Key, AlertCircle, RotateCcw } from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [inbounds, setInbounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [editMode, setEditMode] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [email, setEmail] = useState('');
  const [inboundId, setInboundId] = useState('');
  const [uuid, setUuid] = useState('');
  const [totalGb, setTotalGb] = useState('100');
  const [expiryDays, setExpiryDays] = useState('30');
  const [enable, setEnable] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Fetch inbounds
      const inbData = await api.getInbounds();
      setInbounds(inbData);

      // 2. Fetch clients
      const cliData = await api.getClients();
      setClients(cliData);
      setError('');
    } catch (err) {
      setError(err.message || 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateUUID = () => {
    // Generate standard v4-like UUID
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    const newUuid = `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    setUuid(newUuid);
  };

  const handleOpenAddModal = () => {
    setEditMode(false);
    setClientId(null);
    setEmail('');
    generateUUID();
    setTotalGb('100');
    setExpiryDays('30');
    setEnable(true);
    setModalError('');
    
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
    setTotalGb(client.total_gb.toString());
    setExpiryDays(''); // Keep empty, indicating "don't change" unless they input a new value
    setEnable(client.enable);
    setModalError('');
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
    
    const payload = {
      inbound_id: parseInt(inboundId),
      email,
      uuid,
      total_gb: parseFloat(totalGb),
      enable,
      // Only send expiry_days if they provided one, or 0 if they set unlimited. Otherwise send null to keep unchanged
      expiry_days: expiryDays !== '' ? parseInt(expiryDays) : null
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
    if (!window.confirm(`"${client.email}" kullanıcısını silmek istediğinizden emin misiniz?\nBu işlem Xray config'inden kullanıcıyı kaldıracaktır.`)) {
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
    if (!window.confirm(`"${client.email}" kullanıcısının bugüne kadar tükettiği yükleme/indirme trafiğini sıfırlamak istediğinizden emin misiniz?`)) {
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
    if (timestamp === 0) return 'Sınırsız';
    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR');
  };

  const isClientActive = (client) => {
    if (!client.enable) return false;
    
    // Expiry check
    if (client.expiry_time > 0 && Date.now() > client.expiry_time) {
      return false;
    }

    // Bandwidth check
    if (client.total_gb > 0) {
      const limit_bytes = client.total_gb * 1024 * 1024 * 1024;
      if (client.up + client.down >= limit_bytes) {
        return false;
      }
    }

    return true;
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
        <button className="btn-primary" onClick={handleOpenAddModal} disabled={actionLoading || inbounds.length === 0}>
          <Plus size={16} style={{ marginRight: '5px' }} /> Yeni Kullanıcı Ekle
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
                <th>E-posta</th>
                <th>Inbound</th>
                <th>UUID / Şifre</th>
                <th>Kullanılan Trafik</th>
                <th>Kota Sınırı</th>
                <th>Son Kullanma</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    {inbounds.length === 0 
                      ? 'Kullanıcı ekleyebilmek için önce en az bir inbound bağlantısı oluşturmalısınız.' 
                      : 'Kayıtlı kullanıcı bulunmuyor. Yeni bir tane ekleyerek başlayın.'}
                  </td>
                </tr>
              ) : (
                clients.map((client) => {
                  const active = isClientActive(client);
                  const isTrafficExceeded = client.total_gb > 0 && (client.up + client.down) >= (client.total_gb * 1024 * 1024 * 1024);
                  const isTimeExpired = client.expiry_time > 0 && Date.now() > client.expiry_time;

                  return (
                    <tr key={client.id}>
                      <td style={{ fontWeight: '600' }}>{client.email}</td>
                      <td>
                        <span className="badge badge-info">{client.inbound_remark || 'Bilinmiyor'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <Key size={12} style={{ color: 'var(--accent-cyan)' }} />
                          <span title={client.uuid}>{client.uuid.substring(0, 8)}...{client.uuid.substring(client.uuid.length - 8)}</span>
                        </div>
                      </td>
                      <td>{formatTraffic(client.up + client.down)}</td>
                      <td>{client.total_gb > 0 ? `${client.total_gb} GB` : 'Sınırsız'}</td>
                      <td>{formatExpiry(client.expiry_time)}</td>
                      <td>
                        <button 
                          onClick={() => handleToggle(client)} 
                          disabled={actionLoading}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          title="Oturumu Aktifleştir / Durdur"
                        >
                          {active ? (
                            <span className="badge badge-success">
                              <CheckCircle size={10} style={{ marginRight: '3px' }} /> Aktif
                            </span>
                          ) : isTrafficExceeded ? (
                            <span className="badge badge-warning" title="Kota Sınırı Aşıldı">
                              Kota Aşıldı
                            </span>
                          ) : isTimeExpired ? (
                            <span className="badge badge-warning" title="Süresi Doldu">
                              Süre Doldu
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
                          <button className="btn-icon" title="Trafiği Sıfırla" onClick={() => handleResetTraffic(client)} disabled={actionLoading}>
                            <RotateCcw size={14} />
                          </button>
                          <button className="btn-icon" title="Düzenle" onClick={() => handleOpenEditModal(client)} disabled={actionLoading}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-icon delete" title="Sil" onClick={() => handleDelete(client)} disabled={actionLoading}>
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
      )}

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editMode ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>×</button>
            </div>
            
            {modalError && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="modal-email">E-posta</label>
                <input
                  id="modal-email"
                  type="email"
                  className="form-input"
                  placeholder="örn. user@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-inbound">Bağlanacağı Inbound</label>
                <select
                  id="modal-inbound"
                  className="form-input"
                  value={inboundId}
                  onChange={(e) => setInboundId(e.target.value)}
                  required
                  disabled={actionLoading}
                >
                  {inbounds.map(i => (
                    <option key={i.id} value={i.id}>{i.remark || i.port} ({i.protocol.toUpperCase()} - {i.port})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-uuid">Kullanıcı UUID / Şifre</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="modal-uuid"
                    type="text"
                    className="form-input"
                    value={uuid}
                    onChange={(e) => setUuid(e.target.value)}
                    required
                    disabled={actionLoading}
                  />
                  <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }} onClick={generateUUID} disabled={actionLoading}>
                    <RefreshCw size={14} /> Üret
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-totalgb">Kota Limiti (GB) - 0: Sınırsız</label>
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
                    {editMode ? 'Süre Ekle (Gün) - Boş bırak: Değişmesin' : 'Süre (Gün) - 0: Sınırsız'}
                  </label>
                  <input
                    id="modal-expiry"
                    type="number"
                    className="form-input"
                    placeholder={editMode ? 'Değişiklik yok' : 'örn. 30'}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    required={!editMode}
                    disabled={actionLoading}
                  />
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                <input
                  id="modal-enable"
                  type="checkbox"
                  checked={enable}
                  onChange={(e) => setEnable(e.target.checked)}
                  disabled={actionLoading}
                />
                <label className="form-label" htmlFor="modal-enable" style={{ cursor: 'pointer' }}>Hesap Aktif</label>
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
