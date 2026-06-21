import React, { createContext, useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { translations } from '../services/translations';
import { CheckCircle, XCircle, Info, HelpCircle } from 'lucide-react';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => localStorage.getItem('lang') || 'tr');
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('theme');
    const validThemes = ['dark', 'light', 'emerald', 'nord', 'midnight', 'sakura', 'dracula', 'cyberpunk', 'slate_emerald', 'midnight_gold', 'arctic_frost', 'deep_forest'];
    if (validThemes.includes(saved)) return saved;
    return 'dark'; // Default theme
  });
  const [toast, setToast] = useState(null); // { message, type }
  const [systemHistory, setSystemHistory] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { message, resolve }

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const setLanguage = (lang) => {
    const validLanguages = ['tr', 'en', 'de', 'fr', 'ru'];
    if (validLanguages.includes(lang)) {
      setLanguageState(lang);
    }
  };

  const setTheme = (newTheme) => {
    const validThemes = ['dark', 'light', 'emerald', 'nord', 'midnight', 'sakura', 'dracula', 'cyberpunk', 'slate_emerald', 'midnight_gold', 'arctic_frost', 'deep_forest'];
    if (validThemes.includes(newTheme)) {
      setThemeState(newTheme);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const confirm = (message) => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  };

  const t = (key) => {
    const dict = translations[language] || translations['tr'];
    return dict[key] || key;
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, theme, setTheme, t, showToast, systemHistory, setSystemHistory, confirm }}>
      {children}
      
      {/* Custom Toast Notification Component */}
      {toast && createPortal(
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translate(-50%, 0)',
          zIndex: 10000000,
          background: theme === 'light' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(10, 15, 30, 0.35)',
          border: '1px solid',
          borderColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.35)' : toast.type === 'info' ? 'rgba(6, 182, 212, 0.35)' : 'rgba(16, 185, 129, 0.35)',
          boxShadow: toast.type === 'error' 
            ? '0 8px 32px 0 rgba(239, 68, 68, 0.15), inset 0 0 12px rgba(239, 68, 68, 0.15)' 
            : toast.type === 'info' 
              ? '0 8px 32px 0 rgba(6, 182, 212, 0.15), inset 0 0 12px rgba(6, 182, 212, 0.15)' 
              : '0 8px 32px 0 rgba(16, 185, 129, 0.15), inset 0 0 12px rgba(16, 185, 129, 0.15)',
          borderRadius: '9999px',
          padding: '0.65rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          fontWeight: '600',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          animation: 'toastSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}>
          {toast.type === 'error' ? (
            <XCircle size={16} style={{ color: 'var(--danger)' }} />
          ) : toast.type === 'info' ? (
            <Info size={16} style={{ color: 'var(--accent-cyan)' }} />
          ) : (
            <CheckCircle size={16} style={{ color: 'var(--success)' }} />
          )}
          <span style={{ whiteSpace: 'nowrap' }}>{toast.message}</span>
        </div>,
        document.body
      )}

      {/* Custom Center Confirm Modal Component */}
      {confirmState && createPortal(
        <div className="modal-overlay" style={{ zIndex: 100000000 }}>
          <div className="modal-content glass-card glow-cyan animate-fade-in" style={{
            maxWidth: '400px',
            padding: '2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            background: 'var(--bg-modal-solid)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--warning)',
              marginBottom: '0.5rem'
            }}>
              <HelpCircle size={24} />
            </div>
            
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {t('confirm_title') || (language === 'tr' ? 'Onay Gerekiyor' : 'Confirmation Required')}
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: '0.5rem 0' }}>
              {confirmState.message}
            </p>
            
            <div style={{ display: 'flex', width: '100%', gap: '0.75rem', marginTop: '1rem' }}>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                style={{ flex: 1, padding: '0.65rem', borderRadius: '12px' }}
              >
                {t('cancel')}
              </button>
              
              <button 
                className="btn-primary" 
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                style={{ flex: 1, padding: '0.65rem', borderRadius: '12px', background: 'var(--danger)' }}
              >
                {language === 'tr' ? 'Evet, Onayla' : 'Yes, Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </SettingsContext.Provider>
  );
};
