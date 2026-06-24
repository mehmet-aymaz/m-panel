import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { RefreshCw, Terminal, Trash2, Play, Pause } from 'lucide-react';

export default function Logs() {
  const { showToast } = useSettings();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logContainerRef = useRef(null);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getXrayLogs();
      setLogs(data.logs || []);
    } catch (err) {
      showToast('Xray logları alınamadı: ' + err.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto refresh effect
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClearLogs = () => {
    setLogs([]);
    showToast('Ekran temizlendi.', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
      {/* Toolbar */}
      <div className="glass-card toolbar-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={18} style={{ color: 'var(--accent-cyan)' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>Xray Sistem Günlükleri (Loglar)</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className={`badge ${autoRefresh ? 'badge-success' : 'badge-info'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              border: '1px solid var(--border-color)',
              background: autoRefresh ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: autoRefresh ? '#34d399' : 'var(--text-secondary)',
              cursor: 'pointer',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s ease',
            }}
          >
            {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
            {autoRefresh ? 'Otomatik Yenileme Açık' : 'Otomatik Yenileme Kapalı'}
          </button>

          <button
            className="btn-icon"
            title="Yenile"
            onClick={() => fetchLogs()}
            disabled={loading}
            style={{ width: '36px', height: '36px', borderRadius: '10px' }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
          </button>

          <button
            className="btn-icon"
            title="Ekranı Temizle"
            onClick={handleClearLogs}
            style={{ width: '36px', height: '36px', borderRadius: '10px', color: 'var(--danger)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div 
        className="glass-card" 
        style={{ 
          flex: 1, 
          background: '#090d16', 
          border: '1px solid var(--border-color)', 
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)'
        }}
      >
        {loading && logs.length === 0 ? (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <div className="brand-icon" style={{ width: '32px', height: '32px', animation: 'spin 1.5s linear infinite' }}>M</div>
            <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Loglar yükleniyor...</span>
          </div>
        ) : (
          <div 
            ref={logContainerRef}
            className="no-scrollbar"
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              color: '#d1d5db',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '2rem' }}>
                Kayıtlı sistem günlüğü bulunmuyor.
              </div>
            ) : (
              logs.map((line, idx) => {
                let color = '#d1d5db';
                if (line.toLowerCase().includes('[warning]') || line.toLowerCase().includes('warn')) {
                  color = '#f59e0b';
                } else if (line.toLowerCase().includes('[error]') || line.toLowerCase().includes('fail') || line.toLowerCase().includes('err')) {
                  color = '#ef4444';
                } else if (line.toLowerCase().includes('accepted') || line.toLowerCase().includes('success')) {
                  color = '#10b981';
                } else if (line.toLowerCase().includes('email:')) {
                  color = '#06b6d4';
                }

                return (
                  <div key={idx} style={{ color, marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.01)', paddingBottom: '2px' }}>
                    {line}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
