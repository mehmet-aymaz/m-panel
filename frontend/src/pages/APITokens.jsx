import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { Key, Copy, Plus, Trash2, ShieldAlert, Check, CheckCircle2 } from 'lucide-react';

export default function APITokens() {
  const { t, showToast } = useSettings();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('read_only');
  const [createdToken, setCreatedToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const scopeDropdownRef = useRef(null);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const data = await api.getAPITokens();
      setTokens(data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(event.target)) {
        setIsScopeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Lütfen geçerli bir anahtar adı girin.', 'error');
      return;
    }
    try {
      const data = await api.createAPIToken({ name, scope });
      setCreatedToken(data);
      setName('');
      setScope('read_only');
      fetchTokens();
      showToast(t('token_copied_toast') || 'API Anahtarı oluşturuldu!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('delete_token_confirm') || 'Bu API anahtarını silmek istediğinize emin misiniz?')) {
      return;
    }
    try {
      await api.deleteAPIToken(id);
      showToast('API Anahtarı silindi.', 'success');
      fetchTokens();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCopy = () => {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken.token);
      setCopied(true);
      showToast(t('token_copied_toast') || 'Kopyalandı!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const scopeOptions = [
    { id: 'read_only', label: t('scope_read_only') || 'Salt Okunur (read_only)' },
    { id: 'client_manage', label: t('scope_client_manage') || 'Kullanıcı Yönetimi (client_manage)' },
    { id: 'full_access', label: t('scope_full_access') || 'Tam Yetki (full_access)' }
  ];
  const currentScope = scopeOptions.find(o => o.id === scope) || scopeOptions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', margin: 0 }}>
          <Key size={20} style={{ color: 'var(--accent-cyan)' }} />
          {t('api_tokens') || 'API Anahtarları'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          {t('api_tokens_desc') || 'Üçüncü parti entegrasyonlar için uzun ömürlü ve yetkilendirilmiş API erişim anahtarları.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Token Creation Form */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} style={{ color: 'var(--accent-cyan)' }} />
            {t('add_token') || 'Yeni API Anahtarı Ekle'}
          </h3>
          
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                {t('token_name') || 'Anahtar Adı'}
              </label>
              <input 
                type="text" 
                className="form-input" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Örn: Telegram Bot, Fatura Sistemi"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                {t('token_scope') || 'Yetki Seviyesi (Scope)'}
              </label>
              
              <div ref={scopeDropdownRef} style={{ position: 'relative', width: '100%', zIndex: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsScopeOpen(!isScopeOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    height: '42px'
                  }}
                >
                  <span>{currentScope.label}</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
                </button>

                {isScopeOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-modal-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    zIndex: 9999,
                    boxShadow: 'var(--shadow-lg)',
                    animation: 'fadeIn 0.2s ease-out forwards',
                  }}>
                    {scopeOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setScope(opt.id);
                          setIsScopeOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.6rem 1rem',
                          color: scope === opt.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                          background: scope === opt.id ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: scope === opt.id ? '600' : '500',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (scope !== opt.id) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (scope !== opt.id) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Scope descriptions helper */}
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {scope === 'read_only' && (t('scope_read_only_desc') || 'Sadece durum izleme, loglar ve veri listeleme yapabilir (GET istekleri).')}
                {scope === 'client_manage' && (t('scope_client_manage_desc') || 'Kullanıcı (client) ekleme, silme, düzenleme yapabilir; protokol ve sistem ayarlarına erişemez.')}
                {scope === 'full_access' && (
                  <span style={{ color: 'var(--warning)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <ShieldAlert size={12} />
                    {t('scope_full_access_desc') || 'Tüm yetkilere sahiptir. Sunucu ve protokol ayarlarını değiştirebilir.'}
                  </span>
                )}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '600' }}>
              <Plus size={16} />
              {t('create_token_btn') || 'API Anahtarı Oluştur'}
            </button>
          </form>
        </div>

        {/* Tokens List */}
        <div className="glass-card" style={{ padding: '1.5rem', flex: 1 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
            {t('api_tokens') || 'Aktif API Anahtarları'}
          </h3>
          
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Yükleniyor...
            </div>
          ) : tokens.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {t('no_tokens') || 'Henüz bir API anahtarı oluşturulmamış.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{t('name') || 'Anahtar Adı'}</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{t('token_scope_label') || 'Kapsam'}</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{t('token_label') || 'Anahtar'}</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }} style={{ textAlign: 'right' }}>{t('actions') || 'İşlemler'}</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr key={token.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500', color: 'var(--text-primary)' }}>{token.name}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span className={`badge ${token.scope === 'full_access' ? 'badge-danger' : token.scope === 'client_manage' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.7rem' }}>
                          {token.scope}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{token.token}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleDelete(token.id)}
                          style={{ color: 'var(--danger)', padding: '4px', background: 'transparent', border: 'none' }}
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Created Token Modal */}
      {createdToken && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', padding: '2rem', position: 'relative', background: 'var(--bg-modal-solid)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <CheckCircle2 size={24} />
              {t('token_created_title') || 'API Anahtarı Başarıyla Oluşturuldu!'}
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              {t('token_warning_msg') || 'Lütfen bu anahtarı güvenli bir yere kopyalayın. Güvenlik nedeniyle bu anahtar bir daha gösterilmeyecektir.'}
            </p>

            <div style={{ background: '#090d16', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#d1d5db', wordBreak: 'break-all', select: 'all' }}>
                {createdToken.token}
              </span>
              <button 
                onClick={handleCopy} 
                className="btn-icon" 
                style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}
                title="Kopyala"
              >
                {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
              </button>
            </div>

            <button 
              className="btn-primary" 
              onClick={() => setCreatedToken(null)}
              style={{ width: '100%', padding: '0.75rem', fontWeight: '600' }}
            >
              Tamam
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
