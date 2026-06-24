import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { Cpu, Database, HardDrive, Shield, AlertTriangle, Activity, CheckCircle2, XCircle, ArrowUp, ArrowDown, Users, RefreshCw, Play, Power } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// Custom SVG Circular Dial Component
function RadialGauge({ value, color, label, icon: Icon, details, subdetails }) {
  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="glass-card glow-cyan" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '180px' }}>
      <div style={{ position: 'relative', width: radius * 2, height: radius * 2 }}>
        <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            stroke="rgba(255, 255, 255, 0.03)"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color, marginBottom: '2px' }} />
          <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>{Math.round(value)}%</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>{label}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: '500' }}>{details}</p>
        {subdetails && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{subdetails}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, showToast, systemHistory, setSystemHistory } = useSettings();
  const [status, setStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Network speed states
  const [lastNetIo, setLastNetIo] = useState(null);
  const [speed, setSpeed] = useState({ up: 0, down: 0 });

  // Format bytes helper
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format uptime helper
  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / (24 * 3600));
    const h = Math.floor((seconds % (24 * 3600)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    
    let parts = [];
    if (d > 0) parts.push(`${d} ${t('uptime_days')}`);
    if (h > 0) parts.push(`${h} ${t('uptime_hours')}`);
    if (m > 0 || parts.length === 0) parts.push(`${m} ${t('uptime_mins')}`);
    return parts.join(' ');
  };

  const handleXrayControl = async (action) => {
    setActionLoading(true);
    try {
      const res = await api.controlXray(action);
      // Reload system status to reflect the new state immediately
      const data = await api.getSystemStatus();
      setStatus(data);
      showToast(res.message || `${action} action completed successfully.`, 'success');
    } catch (e) {
      showToast("Hata: " + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    let intervalId;
    
    const fetchData = async () => {
      try {
        // 1. Fetch system status
        const data = await api.getSystemStatus();
        setStatus(data);

        // 2. Fetch dashboard summary stats
        const summaryData = await api.getDashboardSummary();
        setSummary(summaryData);
        setError('');
        
        // Calculate network speed
        if (data.net_io) {
          const now = Date.now();
          if (lastNetIo) {
            const timeDiff = (now - lastNetIo.timestamp) / 1000;
            if (timeDiff > 0) {
              const upSpeed = Math.max(0, (data.net_io.bytes_sent - lastNetIo.bytes_sent) / timeDiff);
              const downSpeed = Math.max(0, (data.net_io.bytes_recv - lastNetIo.bytes_recv) / timeDiff);
              setSpeed({ up: upSpeed, down: downSpeed });
            }
          }
          setLastNetIo({
            bytes_sent: data.net_io.bytes_sent,
            bytes_recv: data.net_io.bytes_recv,
            timestamp: now
          });
        }

        // Update chart history
        setSystemHistory(prev => {
          const newPoint = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            cpu: data.cpu_usage || 0,
            ram: data.memory?.percent || 0,
          };
          const updated = [...prev, newPoint];
          if (updated.length > 20) {
            return updated.slice(updated.length - 20);
          }
          return updated;
        });
      } catch (err) {
        setError(err.message || t('error_conn'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalId = setInterval(fetchData, 5000);

    return () => clearInterval(intervalId);
  }, [lastNetIo]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px' }}>
        <div className="brand-icon animate-spin" style={{ width: '40px', height: '40px', animation: 'spin 1.5s linear infinite' }}>M</div>
        <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>{t('loading')}</span>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="glass-card glow-cyan" style={{ padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <AlertTriangle size={48} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>{t('error_conn')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>{t('retry')}</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 4 Circular gauges row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
        <RadialGauge
          value={status?.cpu_usage || 0}
          color="var(--accent-cyan)"
          label={t('cpu_usage')}
          icon={Cpu}
          details={`Cores: ${status?.cpu_cores || 1}`}
        />
        <RadialGauge
          value={status?.memory?.percent || 0}
          color="var(--accent-purple)"
          label={t('memory')}
          icon={Database}
          details={formatBytes(status?.memory?.used_bytes)}
          subdetails={`Total: ${formatBytes(status?.memory?.total_bytes)}`}
        />
        <RadialGauge
          value={status?.swap?.percent || 0}
          color="var(--warning)"
          label={t('swap')}
          icon={Database}
          details={formatBytes(status?.swap?.used_bytes)}
          subdetails={`Total: ${formatBytes(status?.swap?.total_bytes)}`}
        />
        <RadialGauge
          value={status?.disk?.percent || 0}
          color="var(--accent-blue)"
          label={t('disk_space')}
          icon={HardDrive}
          details={formatBytes(status?.disk?.used_bytes)}
          subdetails={`Total: ${formatBytes(status?.disk?.total_bytes)}`}
        />
      </div>

      {/* Test Update Banner */}
      <div className="glass-card glow-cyan" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid var(--accent-cyan)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={20} style={{ color: 'var(--accent-cyan)' }} />
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>M-Panel Güncelleme Test Butonu</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>Bu buton panel güncelleme işlevini doğrulamak amacıyla geçici olarak eklenmiştir.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => alert('Güncelleme testi başarılı! / Update test successful!')}>
          Test Butonu
        </button>
      </div>

      {/* Grid of chart, traffic speed & xray status */}
      <div className="charts-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Traffic speeds card */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
              {t('live_speed')}
            </h2>
            <div className="dashboard-stats-grid">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center' }}>
                  <ArrowUp size={18} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('upload')}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatBytes(speed.up)}/s</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center' }}>
                  <ArrowDown size={18} style={{ color: 'var(--accent-blue)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('download')}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>{formatBytes(speed.down)}/s</div>
                </div>
              </div>
            </div>
            
            <div className="dashboard-stats-grid" style={{ marginTop: '1.25rem' }}>
              <div style={{ padding: '0.5rem 1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('total_traffic')} ({t('sent')}):</span>
                <span style={{ fontSize: '0.95rem', fontWeight: '700', marginLeft: '0.5rem', color: 'var(--text-primary)' }}>{formatBytes(status?.net_io?.bytes_sent)}</span>
              </div>
              <div style={{ padding: '0.5rem 1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('total_traffic')} ({t('received')}):</span>
                <span style={{ fontSize: '0.95rem', fontWeight: '700', marginLeft: '0.5rem', color: 'var(--text-primary)' }}>{formatBytes(status?.net_io?.bytes_recv)}</span>
              </div>
            </div>
          </div>

          {/* Live system chart */}
          <div className="glass-card chart-card">
            <h2>
              <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
              {t('system_graph')}
            </h2>
            <div style={{ flex: 1, width: '100%', height: '100%', minHeight: '220px' }}>
              {systemHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={systemHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-purple)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--accent-purple)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={10} domain={[0, 100]} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="cpu" name="CPU (%)" stroke="var(--accent-cyan)" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                    <Area type="monotone" dataKey="ram" name="RAM (%)" stroke="var(--accent-purple)" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  Loading history...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Xray core status */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'fit-content' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Shield size={18} style={{ color: status?.xray_service_active ? 'var(--success)' : 'var(--danger)' }} />
              {t('xray_status')}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('status')}</span>
                {status?.xray_service_active ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle2 size={12} /> {t('running')}
                  </span>
                ) : (
                  <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <XCircle size={12} /> {t('stopped')}
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('version')}</span>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>v26.3.27</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('protocols')}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>VLESS, VMess, Trojan</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('uptime')}</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' }}>{formatUptime(status?.uptime)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('connections')} (TCP/UDP)</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                  {status?.connections?.tcp || 0} / {status?.connections?.udp || 0}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ textAlign: 'center', flex: 1, padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('total_clients')}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '700', marginTop: '0.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <Users size={16} style={{ color: 'var(--accent-purple)' }} />
                  {summary?.active_clients_count || 0}
                </div>
              </div>
              
              <div style={{ textAlign: 'center', flex: 1, padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('inbound_mgmt')}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '700', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                  {summary?.total_inbounds_count || 0}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                className="btn-primary" 
                onClick={() => handleXrayControl('start')} 
                disabled={actionLoading || status?.xray_service_active}
                style={{ flex: 1, padding: '0.6rem 0.5rem', fontSize: '0.8rem', background: status?.xray_service_active ? 'var(--text-muted)' : 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                <Play size={12} />
                {t('start')}
              </button>
              
              <button 
                className="btn-secondary" 
                onClick={() => handleXrayControl('stop')} 
                disabled={actionLoading || !status?.xray_service_active}
                style={{ flex: 1, padding: '0.6rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                <Power size={12} />
                {t('stop')}
              </button>
              
              <button 
                className="form-button" 
                onClick={() => handleXrayControl('restart')} 
                disabled={actionLoading}
                style={{ flex: 1, padding: '0.6rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', boxShadow: 'none' }}
              >
                <RefreshCw size={12} className={actionLoading ? 'animate-spin' : ''} />
                {t('restart')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
