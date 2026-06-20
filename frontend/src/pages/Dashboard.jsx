import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Cpu, Database, HardDrive, Shield, AlertTriangle, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// Custom SVG Circular Dial Component
function RadialGauge({ value, color, label, icon: Icon, details }) {
  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="glass-card glow-cyan" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', flex: 1 }}>
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
          <Icon size={20} style={{ color, marginBottom: '2px' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>{Math.round(value)}%</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>{label}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{details}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  useEffect(() => {
    let intervalId;
    
    const fetchStatus = async () => {
      try {
        const data = await api.getSystemStatus();
        setStatus(data);
        setError('');
        
        // Update history for live graph (max 10 data points)
        setHistory(prev => {
          const newPoint = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            cpu: data.cpu_usage || 0,
            ram: data.memory?.percent || 0,
          };
          const updated = [...prev, newPoint];
          if (updated.length > 10) {
            return updated.slice(updated.length - 10);
          }
          return updated;
        });
      } catch (err) {
        setError(err.message || 'Sistem durum verileri alınamadı.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 5000);

    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px' }}>
        <div className="brand-icon animate-fade-in" style={{ width: '40px', height: '40px', animation: 'spin 1.5s linear infinite' }}>M</div>
        <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Yükleniyor...</span>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <AlertTriangle size={48} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>Bağlantı Hatası</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Yeniden Dene</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top gauges row */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <RadialGauge
          value={status?.cpu_usage || 0}
          color="var(--accent-cyan)"
          label="CPU Kullanımı"
          icon={Cpu}
          details="Anlık İşlemci Yükü"
        />
        <RadialGauge
          value={status?.memory?.percent || 0}
          color="var(--accent-purple)"
          label="Bellek (RAM)"
          icon={Database}
          details={`${formatBytes(status?.memory?.used_bytes)} / ${formatBytes(status?.memory?.total_bytes)}`}
        />
        <RadialGauge
          value={status?.disk?.percent || 0}
          color="var(--accent-blue)"
          label="Disk Alanı"
          icon={HardDrive}
          details={`${formatBytes(status?.disk?.used_bytes)} / ${formatBytes(status?.disk?.total_bytes)}`}
        />
      </div>

      {/* Grid of chart and service info */}
      <div className="charts-grid">
        {/* Live system chart */}
        <div className="glass-card chart-card">
          <h2>
            <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
            Canlı Sistem Grafiği (Son 50 saniye)
          </h2>
          <div style={{ flex: 1, width: '100%', height: '100%' }}>
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <XAxis dataKey="time" stroke="#4b5563" fontSize={10} tickLine={false} />
                  <YAxis stroke="#4b5563" fontSize={10} domain={[0, 100]} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="cpu" name="CPU (%)" stroke="var(--accent-cyan)" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                  <Area type="monotone" dataKey="ram" name="RAM (%)" stroke="var(--accent-purple)" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Veri toplanıyor...
              </div>
            )}
          </div>
        </div>

        {/* Xray core status */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} style={{ color: status?.xray_service_active ? 'var(--success)' : 'var(--danger)' }} />
              Xray Çekirdek Durumu
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Servis Durumu</span>
                {status?.xray_service_active ? (
                  <span className="badge badge-success">
                    <CheckCircle2 size={12} style={{ marginRight: '3px' }} /> Çalışıyor
                  </span>
                ) : (
                  <span className="badge badge-danger">
                    <XCircle size={12} style={{ marginRight: '3px' }} /> Durduruldu
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sürüm</span>
                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>v26.3.27</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Aktif Protokoller</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>VLESS, VMess, Trojan</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center', flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Uptime</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', marginTop: '0.25rem', color: 'var(--text-primary)' }}>Aktif</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Toplam Kullanıcı</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', marginTop: '0.25rem', color: 'var(--text-primary)' }}>0</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
