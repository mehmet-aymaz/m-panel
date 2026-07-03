/**
 * NodeDetail.jsx — 3x-ui API Node Yönetim Sayfası
 *
 * Rota: /nodes/:id
 * - Üst: Sunucu durumu (CPU/RAM/Disk)
 * - Alt: Tab yapısı → [Inbound'lar] | [Kullanıcılar]
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import {
  Server, ArrowLeft, RefreshCw, Cpu, Database, HardDrive,
  Plus, Trash2, RotateCcw, Users, Radio, AlertCircle,
  CheckCircle, Activity, Wifi, WifiOff, ChevronRight
} from 'lucide-react';

// ─── Yardımcı ────────────────────────────────────────────────────────────────

function formatBytes(bytes = 0, d = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(d)) + ' ' + sizes[i];
}

function StatBar({ label, icon: Icon, pct, color, detail }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '500' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
          <Icon size={13} /> {label}
        </span>
        <span style={{ color: 'var(--text-primary)' }}>
          {Math.round(pct)}%
          {detail && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.3rem' }}>{detail}</span>}
        </span>
      </div>
      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function NodeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, showToast, confirm } = useSettings();
  const nodeId = parseInt(id);

  const [node, setNode] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState('inbounds'); // 'inbounds' | 'clients'

  // Inbound listesi
  const [inbounds, setInbounds] = useState([]);
  const [inboundLoading, setInboundLoading] = useState(false);

  // Seçili inbound → kullanıcı listesi
  const [selectedInbound, setSelectedInbound] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);

  // Modaller
  const [addClientModal, setAddClientModal] = useState(false);
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientUuid, setNewClientUuid] = useState('');
  const [newClientLimitGb, setNewClientLimitGb] = useState(0);
  const [newClientExpiryDays, setNewClientExpiryDays] = useState(0);
  
  // Client Düzenleme Modalı
  const [editClientModal, setEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null); // Güncellenen client objesi
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editClientUuid, setEditClientUuid] = useState('');
  const [editClientLimitGb, setEditClientLimitGb] = useState(0);
  const [editClientExpiryDays, setEditClientExpiryDays] = useState(0);

  // Inbound Ekleme Modalı
  const [addInboundModal, setAddInboundModal] = useState(false);
  const [newIbRemark, setNewIbRemark] = useState('');
  const [newIbProtocol, setNewIbProtocol] = useState('vless');
  const [newIbPort, setNewIbPort] = useState(443);

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // ─── Veri yükleme ────────────────────────────────────────────────────────────

  const loadNode = useCallback(async () => {
    try {
      const n = await api.getNodes();
      const found = n.find(x => x.id === nodeId);
      if (!found) { navigate('/nodes'); return; }
      if (found.node_type !== 'xui_api') { navigate('/nodes'); return; }
      setNode(found);
    } catch {
      navigate('/nodes');
    } finally {
      setPageLoading(false);
    }
  }, [nodeId, navigate]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await api.getNodeStats(nodeId);
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [nodeId]);

  const loadInbounds = useCallback(async () => {
    setInboundLoading(true);
    try {
      const res = await api.getNodeInbounds(nodeId);
      setInbounds(res.obj || []);
    } catch (err) {
      showToast(err.message || 'Inbound\'lar yüklenemedi.', 'error');
    } finally {
      setInboundLoading(false);
    }
  }, [nodeId, showToast]);

  const loadClients = useCallback(async (inbound) => {
    if (!inbound) return;
    setClientLoading(true);
    try {
      const raw = typeof inbound.settings === 'string' ? JSON.parse(inbound.settings) : (inbound.settings || {});
      const clientList = raw.clients || [];
      
      const clientStats = inbound.clientStats || [];
      const onlines = inbound._onlines || [];
      
      const mapped = clientList.map(c => {
        const stats = clientStats.find(s => s.email === c.email);
        const up = stats ? stats.up : 0;
        const down = stats ? stats.down : 0;
        return {
          ...c,
          up,
          down,
          total: up + down,
          isOnline: onlines.includes(c.email),
          expiryTime: c.expiryTime || (stats ? stats.expiryTime : 0)
        };
      });
      setClients(mapped);
    } catch {
      setClients([]);
    } finally {
      setClientLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNode();
    loadStats();
  }, [loadNode, loadStats]);

  useEffect(() => {
    if (!pageLoading && node) loadInbounds();
  }, [pageLoading, node, loadInbounds]);

  useEffect(() => {
    if (selectedInbound) loadClients(selectedInbound);
  }, [selectedInbound, loadClients]);

  // ─── Inbound aksiyonları ──────────────────────────────────────────────────────

  const handleAddInbound = async (e) => {
    e.preventDefault();
    if (!newIbRemark.trim()) { setModalError('Açıklama zorunludur.'); return; }
    setModalLoading(true);
    try {
      const payload = {
        remark: newIbRemark,
        port: parseInt(newIbPort),
        protocol: newIbProtocol,
        settings: JSON.stringify({ clients: [], decryptions: [], fallbacks: [] }),
        streamSettings: JSON.stringify({ network: 'tcp', security: 'none', tcpSettings: { header: { type: 'none' } } }),
        sniffing: JSON.stringify({ enabled: true, destOverride: ['http', 'tls'] }),
        enable: true
      };
      await api.addNodeInbound(nodeId, payload);
      showToast('Inbound başarıyla eklendi.', 'success');
      setAddInboundModal(false);
      loadInbounds();
    } catch (err) {
      setModalError(err.message || 'Inbound eklenemedi.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteInbound = async (iid) => {
    const ok = await confirm('Bu inbound\'u silmek istiyor musunuz?');
    if (!ok) return;
    try {
      await api.deleteNodeInbound(nodeId, iid);
      showToast('Inbound silindi.', 'success');
      if (selectedInbound?.id === iid) setSelectedInbound(null);
      loadInbounds();
    } catch (err) {
      showToast(err.message || 'Inbound silinemedi.', 'error');
    }
  };

  // ─── Client aksiyonları ───────────────────────────────────────────────────────

  const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  };

  const handleOpenAddClient = () => {
    if (!selectedInbound) { showToast('Önce bir inbound seçin.', 'error'); return; }
    setNewClientEmail('');
    setNewClientUuid(generateUuid());
    setNewClientLimitGb(0);
    setNewClientExpiryDays(0);
    setModalError('');
    setAddClientModal(true);
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientEmail.trim()) { setModalError('E-posta/isim zorunludur.'); return; }
    setModalLoading(true);
    try {
      // expiryTime hesapla: milisaniye cinsinden unixtime (veya eksi değer)
      const expiryTime = newClientExpiryDays > 0 
        ? Date.now() + parseInt(newClientExpiryDays) * 24 * 60 * 60 * 1000 
        : 0;

      const finalId = String(newClientUuid);
      const clientData = { 
        id: finalId, 
        email: newClientEmail, 
        enable: true, 
        flow: '',
        totalGB: newClientLimitGb > 0 ? parseInt(newClientLimitGb) * 1024 * 1024 * 1024 : 0, // byte cinsinden limit
        expiryTime: expiryTime
      };

      // Shadowsocks ise password alanını da set et
      if (selectedInbound?.protocol === 'shadowsocks') {
        clientData.password = finalId;
      }

      await api.addNodeClient(nodeId, selectedInbound.id, clientData);
      showToast('Kullanıcı eklendi.', 'success');
      setAddClientModal(false);
      // Inbound'u taze çek
      await loadInbounds();
    } catch (err) {
      setModalError(err.message || 'Kullanıcı eklenemedi.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenEditClient = (client) => {
    setEditingClient(client);
    setEditClientEmail(client.email || '');
    // id veya password stringe cast edilerek set edilir
    setEditClientUuid(String(client.id || client.password || ''));
    // limit totalGB byte'tan GB'a çevrilir
    setEditClientLimitGb(client.totalGB ? Math.round(client.totalGB / (1024*1024*1024)) : 0);
    // expiryTime'dan kalan gün hesaplama
    if (client.expiryTime && client.expiryTime > Date.now()) {
      const diff = client.expiryTime - Date.now();
      setEditClientExpiryDays(Math.max(1, Math.round(diff / (24*60*60*1000))));
    } else {
      setEditClientExpiryDays(0);
    }
    setModalError('');
    setEditClientModal(true);
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!editClientEmail.trim()) { setModalError('E-posta/isim zorunludur.'); return; }
    setModalLoading(true);
    try {
      const expiryTime = editClientExpiryDays > 0 
        ? Date.now() + parseInt(editClientExpiryDays) * 24 * 60 * 60 * 1000 
        : 0;

      const finalId = String(editClientUuid);
      const clientData = {
        id: finalId,
        email: editClientEmail,
        enable: editingClient.enable !== false,
        flow: editingClient.flow || '',
        totalGB: editClientLimitGb > 0 ? parseInt(editClientLimitGb) * 1024 * 1024 * 1024 : 0,
        expiryTime: expiryTime
      };

      // Shadowsocks ise password alanını da set et
      if (selectedInbound?.protocol === 'shadowsocks') {
        clientData.password = finalId;
      }

      await api.updateNodeClient(nodeId, selectedInbound.id, editingClient.email, clientData);
      showToast('Kullanıcı güncellendi.', 'success');
      setEditClientModal(false);
      await loadInbounds();
    } catch (err) {
      setModalError(err.message || 'Kullanıcı güncellenemedi.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClient = async (client) => {
    const ok = await confirm(`"${client.email}" kullanıcısını silmek istiyor musunuz?`);
    if (!ok) return;
    try {
      await api.deleteNodeClient(nodeId, selectedInbound.id, client.email);
      showToast('Kullanıcı silindi.', 'success');
      await loadInbounds();
    } catch (err) {
      showToast(err.message || 'Kullanıcı silinemedi.', 'error');
    }
  };

  const handleResetTraffic = async (client) => {
    const ok = await confirm(`"${client.email}" kullanıcısının trafiğini sıfırlamak istiyor musunuz?`);
    if (!ok) return;
    try {
      await api.resetNodeClientTraffic(nodeId, selectedInbound.id, client.email);
      showToast('Trafik sıfırlandı.', 'success');
    } catch (err) {
      showToast(err.message || 'Trafik sıfırlanamadı.', 'error');
    }
  };

  // ─── Yükleniyor ───────────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '1rem' }}>
        <div className="brand-icon animate-spin" style={{ width: '36px', height: '36px' }}>M</div>
        <span style={{ color: 'var(--text-secondary)' }}>{t('loading')}</span>
      </div>
    );
  }

  if (!node) return null;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Breadcrumb / Başlık */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className="btn-icon"
          onClick={() => navigate('/nodes')}
          title="Geri"
          style={{ flexShrink: 0 }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <Server size={18} style={{ color: 'var(--accent-cyan)' }} />
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '600', color: 'var(--text-primary)' }}>
            {node.name}
          </h2>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{node.url}</span>
        </div>
        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }} onClick={loadStats}>
          <RefreshCw size={13} className={statsLoading ? 'animate-spin' : ''} />
          Yenile
        </button>
      </div>

      {/* Sunucu Durumu */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={15} /> {t('system_status') || 'Sunucu Durumu'}
        </h3>

        {statsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
            <RefreshCw size={14} className="animate-spin" /> İstatistikler yükleniyor...
          </div>
        ) : stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <StatBar
              label="CPU" icon={Cpu}
              pct={stats.cpu_usage || 0}
              color="var(--accent-cyan)"
            />
            <StatBar
              label="RAM" icon={Database}
              pct={stats.memory?.percent || 0}
              color="var(--accent-purple)"
              detail={`${formatBytes(stats.memory?.used_bytes || stats.memory?.used)} / ${formatBytes(stats.memory?.total_bytes || stats.memory?.total)}`}
            />
            <StatBar
              label="Disk" icon={HardDrive}
              pct={stats.disk?.percent || 0}
              color="var(--accent-blue)"
              detail={`${formatBytes(stats.disk?.used_bytes || stats.disk?.used)} / ${formatBytes(stats.disk?.total_bytes || stats.disk?.total)}`}
            />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Xray:
                <span style={{ color: stats.xray_running ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                  {stats.xray_running ? '● Running' : '● Stopped'}
                </span>
              </div>
              {stats.xray_version && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>v{stats.xray_version}</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={14} /> Sunucu durumu alınamadı. Bağlantıyı kontrol edin.
          </div>
        )}
      </div>

      {/* Tab Navigasyon */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '0' }}>
        {[
          { key: 'inbounds', label: t('nodes_inbounds') || "Inbound'lar", icon: Radio },
          { key: 'clients', label: t('nodes_clients') || 'Kullanıcılar', icon: Users },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1.1rem', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? '600' : '400',
              fontSize: '0.88rem', transition: 'all 0.2s', marginBottom: '-1px',
            }}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Inbound'lar Sekmesi ───────────────────────────────────────────────── */}
      {activeTab === 'inbounds' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Radio size={15} /> {t('nodes_inbounds') || "Inbound'lar"}
              <span className="badge" style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--accent-cyan)', fontSize: '0.72rem' }}>{inbounds.length}</span>
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }} onClick={() => { setNewIbRemark(''); setNewIbPort(Math.floor(Math.random() * 50000) + 10000); setModalError(''); setAddInboundModal(true); }}>
                <Plus size={13} /> Inbound Ekle
              </button>
              <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }} onClick={loadInbounds}>
                <RefreshCw size={13} className={inboundLoading ? 'animate-spin' : ''} /> Yenile
              </button>
            </div>
          </div>

          {inboundLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
              <RefreshCw size={14} className="animate-spin" /> Yükleniyor...
            </div>
          ) : inbounds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Bu sunucuda kayıtlı inbound bulunamadı.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {inbounds.map(ib => {
                const isSelected = selectedInbound?.id === ib.id;
                const settings = typeof ib.settings === 'string' ? JSON.parse(ib.settings || '{}') : (ib.settings || {});
                const clientCount = (settings.clients || []).length;

                return (
                  <div
                    key={ib.id}
                    onClick={() => { setSelectedInbound(ib); setActiveTab('clients'); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.85rem 1rem', borderRadius: '10px', cursor: 'pointer',
                      background: isSelected ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      transition: 'all 0.2s', flexWrap: 'wrap', gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: ib.enable ? 'var(--success)' : 'var(--danger)',
                        flexShrink: 0
                      }} />
                      <div>
                        <div style={{ fontWeight: '500', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {ib.remark || `Inbound #${ib.id}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {ib.protocol?.toUpperCase()} · Port {ib.port} · {clientCount} kullanıcı
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={e => { e.stopPropagation(); setSelectedInbound(ib); setActiveTab('clients'); }}
                      >
                        <Users size={11} /> Kullanıcılar
                      </button>
                      <button
                        className="btn-icon delete"
                        style={{ padding: '0.3rem' }}
                        onClick={e => { e.stopPropagation(); handleDeleteInbound(ib.id); }}
                        title="Sil"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Kullanıcılar Sekmesi ──────────────────────────────────────────────── */}
      {activeTab === 'clients' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          {/* Inbound seçimi */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '200px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <Users size={15} /> {t('nodes_clients') || 'Kullanıcılar'}
              </h3>
              <select
                className="form-input"
                style={{ maxWidth: '220px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                value={selectedInbound?.id || ''}
                onChange={e => {
                  const found = inbounds.find(x => x.id === parseInt(e.target.value));
                  setSelectedInbound(found || null);
                }}
              >
                <option value="">— Inbound seçin —</option>
                {inbounds.map(ib => (
                  <option key={ib.id} value={ib.id}>{ib.remark || `Inbound #${ib.id}`} (Port {ib.port})</option>
                ))}
              </select>
            </div>
            {selectedInbound && (
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }} onClick={handleOpenAddClient}>
                <Plus size={13} /> Kullanıcı Ekle
              </button>
            )}
          </div>

          {!selectedInbound ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Kullanıcıları görüntülemek için bir inbound seçin.
            </div>
          ) : clientLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
              <RefreshCw size={14} className="animate-spin" /> Yükleniyor...
            </div>
          ) : clients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Bu inbound'da kayıtlı kullanıcı yok.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Durum', 'E-posta / İsim', 'UUID', 'Harcanan Veri', 'Kota Limiti', 'Süre Dolum', 'İşlemler'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '500', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <tr key={c.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ 
                            width: '8px', height: '8px', borderRadius: '50%', 
                            background: c.enable !== false ? (c.isOnline ? 'var(--success)' : '#f59e0b') : 'var(--danger)', 
                            display: 'inline-block' 
                          }} />
                          <span style={{ 
                            fontSize: '0.72rem', 
                            color: c.enable !== false ? (c.isOnline ? 'var(--success)' : 'var(--text-muted)') : 'var(--danger)'
                          }}>
                            {c.enable !== false ? (c.isOnline ? 'Aktif (Çevrimiçi)' : 'Aktif (Çevrimdışı)') : 'Pasif'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-primary)', fontWeight: '500' }}>{c.email || '—'}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.id || '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>
                        {formatBytes(c.total || 0)}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>
                        {c.totalGB && c.totalGB > 0 ? formatBytes(c.totalGB) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sınırsız</span>}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>
                        {c.expiryTime && c.expiryTime > 0
                          ? new Date(c.expiryTime).toLocaleDateString('tr-TR')
                          : <span style={{ color: 'var(--text-muted)' }}>Sınırsız</span>
                        }
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            className="btn-icon"
                            onClick={() => handleOpenEditClient(c)}
                            title="Düzenle"
                            style={{ padding: '0.3rem' }}
                          >
                            <RefreshCw size={13} style={{ transform: 'rotate(90deg)' }} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => handleResetTraffic(c)}
                            title="Trafiği Sıfırla"
                            style={{ padding: '0.3rem' }}
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            className="btn-icon delete"
                            onClick={() => handleDeleteClient(c)}
                            title="Sil"
                            style={{ padding: '0.3rem' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inbound Ekle Modal */}
      {addInboundModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Inbound (Port) Ekle</h2>
              <button className="modal-close" onClick={() => setAddInboundModal(false)} disabled={modalLoading}>×</button>
            </div>

            {modalError && (
              <div className="error-banner">
                <AlertCircle size={15} /> <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddInbound}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="ib-remark">Açıklama (Remark)</label>
                  <input
                    id="ib-remark" type="text" className="form-input"
                    placeholder="örneğin: VLESS-Reality-Port"
                    value={newIbRemark}
                    onChange={e => setNewIbRemark(e.target.value)}
                    required disabled={modalLoading}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ib-protocol">Protokol</label>
                  <select
                    id="ib-protocol" className="form-input"
                    value={newIbProtocol}
                    onChange={e => setNewIbProtocol(e.target.value)}
                    disabled={modalLoading}
                  >
                    <option value="vless">VLESS</option>
                    <option value="vmess">VMESS</option>
                    <option value="trojan">Trojan</option>
                    <option value="shadowsocks">Shadowsocks</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ib-port">Port</label>
                  <input
                    id="ib-port" type="number" className="form-input"
                    value={newIbPort}
                    onChange={e => setNewIbPort(e.target.value)}
                    required disabled={modalLoading}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setAddInboundModal(false)} disabled={modalLoading}>İptal</button>
                <button type="submit" className="btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Ekleniyor...' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Kullanıcı Ekle Modal */}
      {addClientModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Kullanıcı Ekle — {selectedInbound?.remark || `Inbound #${selectedInbound?.id}`}</h2>
              <button className="modal-close" onClick={() => setAddClientModal(false)} disabled={modalLoading}>×</button>
            </div>

            {modalError && (
              <div className="error-banner">
                <AlertCircle size={15} /> <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddClient}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="client-email">E-posta / İsim</label>
                  <input
                    id="client-email" type="text" className="form-input"
                    placeholder="kullanici@ornek.com"
                    value={newClientEmail}
                    onChange={e => setNewClientEmail(e.target.value)}
                    required disabled={modalLoading}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="client-uuid">UUID / Şifre</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      id="client-uuid" type="text" className="form-input"
                      value={newClientUuid}
                      onChange={e => setNewClientUuid(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      disabled={modalLoading}
                    />
                    <button type="button" className="btn-secondary" style={{ flexShrink: 0 }} onClick={() => setNewClientUuid(generateUuid())}>
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="client-limit-gb">Kota Trafik Limiti (GB) (0 = Sınırsız)</label>
                  <input
                    id="client-limit-gb" type="number" className="form-input"
                    value={newClientLimitGb}
                    onChange={e => setNewClientLimitGb(e.target.value)}
                    min="0"
                    disabled={modalLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="client-expiry-days">Süre (Gün) (0 = Sınırsız)</label>
                  <input
                    id="client-expiry-days" type="number" className="form-input"
                    value={newClientExpiryDays}
                    onChange={e => setNewClientExpiryDays(e.target.value)}
                    min="0"
                    disabled={modalLoading}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setAddClientModal(false)} disabled={modalLoading}>İptal</button>
                <button type="submit" className="btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Ekleniyor...' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Kullanıcı Düzenleme Modal */}
      {editClientModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Kullanıcıyı Düzenle — {editingClient?.email}</h2>
              <button className="modal-close" onClick={() => setEditClientModal(false)} disabled={modalLoading}>×</button>
            </div>

            {modalError && (
              <div className="error-banner">
                <AlertCircle size={15} /> <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleEditClient}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-client-email">E-posta / İsim</label>
                  <input
                    id="edit-client-email" type="text" className="form-input"
                    value={editClientEmail}
                    onChange={e => setEditClientEmail(e.target.value)}
                    required disabled={modalLoading}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-client-uuid">UUID / Şifre</label>
                  <input
                    id="edit-client-uuid" type="text" className="form-input"
                    value={editClientUuid}
                    onChange={e => setEditClientUuid(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                    disabled={modalLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-client-limit-gb">Kota Trafik Limiti (GB) (0 = Sınırsız)</label>
                  <input
                    id="edit-client-limit-gb" type="number" className="form-input"
                    value={editClientLimitGb}
                    onChange={e => setEditClientLimitGb(e.target.value)}
                    min="0"
                    disabled={modalLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-client-expiry-days">Süre (Kalan Gün) (0 = Sınırsız)</label>
                  <input
                    id="edit-client-expiry-days" type="number" className="form-input"
                    value={editClientExpiryDays}
                    onChange={e => setEditClientExpiryDays(e.target.value)}
                    min="0"
                    disabled={modalLoading}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditClientModal(false)} disabled={modalLoading}>İptal</button>
                <button type="submit" className="btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Kaydediliyor...' : 'Kaydet'}
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
