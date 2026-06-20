import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Info, RefreshCw, Key } from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [inbounds, setInbounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [inboundId, setInboundId] = useState('');
  const [uuid, setUuid] = useState('');
  const [totalGb, setTotalGb] = useState('100');
  const [expiryDays, setExpiryDays] = useState('30');
  const [enable, setEnable] = useState(true);

  // Mock data for demonstration
  const mockInbounds = [
    { id: 1, remark: 'TR-VLESS-XTLS', protocol: 'vless' },
    { id: 2, remark: 'DE-VMESS-WS', protocol: 'vmess' },
    { id: 3, remark: 'NL-TROJAN-TLS', protocol: 'trojan' }
  ];

  const mockClients = [
    {
      id: 1,
      inbound_id: 1,
      inbound_remark: 'TR-VLESS-XTLS',
      email: 'mehmet@aymaz.com.tr',
      uuid: '9e19a0d8-cc38-422d-8857-79b8fae72648',
      total_gb: 150.0,
      up: 15234567890,  // ~14.1 GB
      down: 92345678901, // ~86.0 GB
      expiry_time: Date.now() + 25 * 24 * 60 * 60 * 1000, // 25 days left
      enable: true
    },
    {
      id: 2,
      inbound_id: 1,
      inbound_remark: 'TR-VLESS-XTLS',
      email: 'test_user_vless',
      uuid: 'e77a285a-0ad6-4074-984b-0129a0081d6f',
      total_gb: 50.0,
      up: 25234567890,  // ~23.5 GB
      down: 28345678901, // ~26.4 GB (Total ~49.9 GB - Limit exceeded)
      expiry_time: Date.now() + 5 * 24 * 60 * 60 * 1000,
      enable: true
    },
    {
      id: 3,
      inbound_id: 2,
      inbound_remark: 'DE-VMESS-WS',
      email: 'ahmet_vip',
      uuid: '1e57c6b9-3850-4ff6-9da8-ec2b64d390a8',
      total_gb: 0.0, // Sınırsız
      up: 456789012,
      down: 2345678901,
      expiry_time: Date.now() - 2 * 24 * 60 * 60 * 1000, // Expired 2 days ago
      enable: false
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch inbounds to show in the dropdown
        try {
          const inbData = await api.getInbounds();
          if (inbData && inbData.inbounds && inbData.inbounds.length > 0) {
            setInbounds(inbData.inbounds);
          } else {
            setInbounds(mockInbounds);
          }
        } catch (e) {
          setInbounds(mockInbounds);
        }

        // Fetch clients
        const data = await api.getClients();
        if (data && data.clients && data.clients.length > 0) {
          setClients(data.clients);
        } else {
          setClients(mockClients);
        }
      } catch (err) {
        console.error('Clients could not be fetched:', err);
        setClients(mockClients);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const generateUUID = () => {
    // Generate simple RFC4122 v4 UUID
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    const newUuid = `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    setUuid(newUuid);
  };

  const handleOpenModal = () => {
    generateUUID();
    if (inbounds.length > 0) {
      setInboundId(inbounds[0].id.toString());
    }
    setIsModalOpen(true);
  };

  const handleAddClient = (e) => {
    e.preventDefault();
    const selectedInbound = inbounds.find(i => i.id.toString() === inboundId.toString()) || { remark: 'Belirtilmedi' };
    
    const newClient = {
      id: clients.length + 1,
      inbound_id: parseInt(inboundId),
      inbound_remark: selectedInbound.remark,
      email,
      uuid,
      total_gb: parseFloat(totalGb),
      up: 0,
      down: 0,
      expiry_time: expiryDays > 0 ? Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000 : 0,
      enable
    };

    setClients([...clients, newClient]);
    setIsModalOpen(false);

    // Clear form
    setEmail('');
    setUuid('');
    setTotalGb('100');
    setExpiryDays('30');
    setEnable(true);
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
    
    // Check expiry
    if (client.expiry_time > 0 && Date.now() > client.expiry_time) {
      return false;
    }

    // Check traffic limit
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
      {/* Alert banner indicating placeholder status */}
      <div className="glass-card" style={{
        padding: '1rem',
        border: '1px solid rgba(6, 182, 212, 0.2)',
        background: 'rgba(6, 182, 212, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <Info size={20} style={{ color: 'var(--accent-cyan)' }} />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <strong>Aşama 3 Bilgilendirmesi:</strong> Kullanıcı (Client) ekleme, silme ve düzenleme işlemleri şu an arayüzde taslak moddadır. Aşama 4 kapsamında backend tarafında CRUD işlemleri tamamlandıktan sonra gerçek Xray inbounds'larına bağlanacaktır.
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-primary" onClick={handleOpenModal}>
          <Plus size={16} style={{ marginRight: '5px' }} /> Yeni Kullanıcı Ekle
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          Yükleniyor...
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
              {clients.map((client) => {
                const active = isClientActive(client);
                const isTrafficExceeded = client.total_gb > 0 && (client.up + client.down) >= (client.total_gb * 1024 * 1024 * 1024);
                const isTimeExpired = client.expiry_time > 0 && Date.now() > client.expiry_time;

                return (
                  <tr key={client.id}>
                    <td style={{ fontWeight: '600' }}>{client.email}</td>
                    <td>
                      <span className="badge badge-info">{client.inbound_remark}</span>
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
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-icon" title="Düzenle">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-icon delete" title="Sil">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in">
            <div className="modal-header">
              <h2>Yeni Kullanıcı Ekle (Taslak)</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddClient}>
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
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-inbound">Ekleneceği Inbound</label>
                <select
                  id="modal-inbound"
                  className="form-input"
                  value={inboundId}
                  onChange={(e) => setInboundId(e.target.value)}
                  required
                >
                  {inbounds.map(i => (
                    <option key={i.id} value={i.id}>{i.remark} ({i.protocol.toUpperCase()})</option>
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
                  />
                  <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }} onClick={generateUUID}>
                    <RefreshCw size={14} /> Üret
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-totalgb">Kota Limiti (GB) - 0: Sınırsız</label>
                <input
                  id="modal-totalgb"
                  type="number"
                  className="form-input"
                  value={totalGb}
                  onChange={(e) => setTotalGb(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-expiry">Geçerlilik Süresi (Gün) - 0: Sınırsız</label>
                <input
                  id="modal-expiry"
                  type="number"
                  className="form-input"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <input
                  id="modal-enable"
                  type="checkbox"
                  checked={enable}
                  onChange={(e) => setEnable(e.target.checked)}
                />
                <label className="form-label" htmlFor="modal-enable" style={{ cursor: 'pointer' }}>Başlangıçta Aktif Olsun</label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>İptal</button>
                <button type="submit" className="btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
