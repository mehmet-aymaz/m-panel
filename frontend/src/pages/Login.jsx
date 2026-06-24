import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getAuthToken } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { AlertCircle, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import ThemeSwitcher from '../components/ThemeSwitcher';

export default function Login() {
  const { language, setLanguage, t } = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 2FA login states
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [code, setCode] = useState('');
  
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (getAuthToken()) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (requires2FA) {
      if (!code.trim() || code.length !== 6) {
        setError('Lütfen 6 haneli doğrulama kodunu girin.');
        return;
      }
      setLoading(true);
      try {
        await api.verifyLogin2FA(tempToken, code);
        navigate('/');
      } catch (err) {
        setError(err.message || '2FA doğrulama kodu hatalı.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError(t('login_error'));
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(username, password);
      if (data.status === 'requires_2fa') {
        setRequires2FA(true);
        setTempToken(data.temp_token);
        setError('');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || t('login_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Floating Theme & Language controls in top-right */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
        {/* Custom Language Sliding Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '30px', border: '1px solid var(--border-color)', gap: '2px' }}>
          <button 
            type="button" 
            onClick={() => setLanguage('tr')}
            style={{
              background: language === 'tr' ? 'var(--accent-cyan)' : 'transparent',
              color: language === 'tr' ? '#ffffff' : 'var(--text-sidebar)',
              border: 'none',
              padding: '0.25rem 0.75rem',
              borderRadius: '30px',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            TR
          </button>
          <button 
            type="button" 
            onClick={() => setLanguage('en')}
            style={{
              background: language === 'en' ? 'var(--accent-cyan)' : 'transparent',
              color: language === 'en' ? '#ffffff' : 'var(--text-sidebar)',
              border: 'none',
              padding: '0.25rem 0.75rem',
              borderRadius: '30px',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            EN
          </button>
        </div>
        
        {/* Multi-theme Selector */}
        <ThemeSwitcher />
      </div>

      <div className="login-card glass-card glow-purple animate-fade-in">
        <div className="login-header">
          <div className="brand-icon login-logo" style={{ width: '48px', height: '48px', fontSize: '1.5rem' }}>M</div>
          <h2>{requires2FA ? (t('two_factor_modal_title') || '2FA Doğrulama') : t('welcome')}</h2>
          <p style={{ marginTop: '0.25rem' }}>M-Panel VPN Management Console</p>
        </div>
        
        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {!requires2FA ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="username">{t('username')}</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    id="username"
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder={t('username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label className="form-label" htmlFor="password">{t('password')}</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    placeholder={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label" htmlFor="code">{t('otp_code_label') || '6 Haneli Doğrulama Kodu'}</label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  id="code"
                  type="text"
                  maxLength={6}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.3em', fontWeight: 'bold' }}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
            </div>
          )}
          
          <button type="submit" className="form-button" disabled={loading}>
            {loading ? t('saving') : (requires2FA ? (t('verify_and_enable_btn') || 'Doğrula ve Giriş Yap') : t('login_btn'))}
          </button>
        </form>
      </div>
    </div>
  );
}
