import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, ShieldAlert, CheckCircle, XCircle, Info } from 'lucide-react';

export default function Inbounds() {
  const [inbounds, setInbounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form states
  const [remark, setRemark] = useState('');
  const [protocol, setProtocol] = useState('vless');
  const [port, setPort] = useState('');
  const [enable, setEnable] = useState(true);

  // Mock list to show UI if API returns empty
  const mockInbounds = [
    {
      id: 1,
      remark: 'TR-VLESS-XTLS',
      protocol: 'vless',
      port: 4430,
      enable: true,
      up: 1256789012,
      down: 9876543210,
      total: 0,
      expiry_time: 0
    },
    {
      id: 2,
      remark: 'DE-VMESS-WS',
      protocol: 'vmess',
      port: 8080,
      enable: true,
      up: 543210987,
      down: 4321098765,
      total: 10 * 1024 * 1024 * 1024 * 100, // 1000 GB
      expiry_time: Date.now() + 10 * 24 * 60 * 60 * 1000 // 10 days left
    },
    {
      id: 3,
      remark: 'NL-TROJAN-TLS',
      protocol: 'trojan',
      port: 8443,
      enable: false,
      up: 0,
      down: 0,
      total: 0,
      expiry_time: Date.now() - 24 * 60 * 60 * 1000 // Expired 1 day ago
    }
  ];

  useEffect(() => {
    const fetchInbounds = async () => {
      try {
        const data = await api.getInbounds();
        // If API returns a placeholder response (like empty list or placeholder structure),
        // we merge with mock data so the UI is testable and beautiful.
        if (data && data.inbounds && data.inbounds.length > 0) {
          setInbounds(data.inbounds);
        } else {
          setInbounds(mockInbounds);
        }
      } catch (err) {
        console.error('Inbounds could not be fetched:', err);
        setInbounds(mockInbounds); // Fallback to mock data on error for testing
      } finally {
        setLoading(false);
      }
    };
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

  const handleAddInbound = (e) => {
    e.preventDefault();
    // Simulate adding to state locally for UI demonstration
    const newInbound = {
      id: inbounds.length + 1,
      remark,
      protocol,
      port: parseInt(port),
      enable,
      up: 0,
      down: 0,
      total: 0,
      expiry_time: 0
    };
    setInbounds([...inbounds, newInbound]);
    setIsModalOpen(false);
    
    // Clear form
    setRemark('');
    setProtocol('vless');
    setPort('');
    setEnable(true);
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
          <strong>Aşama 3 Bilgilendirmesi:</strong> Inbound CRUD işlemleri şu an arayüzde taslak (mock) moddadır. Yaptığınız eklemeler yerel bellekte tutulur. Gerçek Xray bağlantı noktaları Aşama 4 kapsamında backend entegrasyonu ile aktifleşecektir.
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} style={{ marginRight: '5px' }} /> Yeni Inbound Ekle
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
                <th>Remark</th>
                <th>Protokol</th>
                <th>Port</th>
                <th>Yükleme (Up)</th>
                <th>İndirme (Down)</th>
                <th>Sınır (Total)</th>
                <th>Süre</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {inbounds.map((inbound) => (
                <tr key={inbound.id}>
                  <td style={{ fontWeight: '600' }}>{inbound.remark}</td>
                  <td>
                    <span className="badge badge-info">{inbound.protocol.toUpperCase()}</span>
                  </td>
                  <td>{inbound.port}</td>
                  <td>{formatTraffic(inbound.up)}</td>
                  <td>{formatTraffic(inbound.down)}</td>
                  <td>{formatTraffic(inbound.total)}</td>
                  <td>{formatExpiry(inbound.expiry_time)}</td>
                  <td>
                    {inbound.enable ? (
                      <span className="badge badge-success">
                        <CheckCircle size={10} style={{ marginRight: '3px' }} /> Aktif
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Inbound Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card glow-cyan animate-fade-in">
            <div className="modal-header">
              <h2>Yeni Inbound Ekle (Taslak)</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddInbound}>
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
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-protocol">Protokol</label>
                <select
                  id="modal-protocol"
                  className="form-input"
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value)}
                >
                  <option value="vless">VLESS</option>
                  <option value="vmess">VMess</option>
                  <option value="trojan">Trojan</option>
                </select>
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
