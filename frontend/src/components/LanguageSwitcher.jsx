import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Check } from 'lucide-react';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages = [
    { id: 'tr', label: 'Türkçe', flagCode: 'tr' },
    { id: 'en', label: 'English', flagCode: 'gb' },
    { id: 'de', label: 'Deutsch', flagCode: 'de' },
    { id: 'fr', label: 'Français', flagCode: 'fr' },
    { id: 'ru', label: 'Русский', flagCode: 'ru' }
  ];

  const currentLanguage = languages.find(l => l.id === language) || languages[0];

  return (
    <div ref={dropdownRef} style={{ position: 'relative', zIndex: isOpen ? 9999 : 1100, width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          fontWeight: '600',
          cursor: 'pointer',
          height: '36px',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(12px)',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img 
            src={`https://flagcdn.com/w40/${currentLanguage.flagCode}.png`} 
            alt={currentLanguage.label} 
            style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', flexShrink: 0 }} 
          />
          <span>{currentLanguage.label}</span>
        </div>
        <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
      </button>

      {isOpen && (
        <div className="switcher-dropdown" style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: 'var(--bg-modal-solid)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: '140px',
          zIndex: 9999,
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'none',
          animation: 'fadeIn 0.2s ease-out forwards',
        }}>
          {languages.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                setLanguage(l.id);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                background: language === l.id ? 'var(--bg-secondary)' : 'transparent',
                color: language === l.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: language === l.id ? '700' : '500',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img 
                  src={`https://flagcdn.com/w40/${l.flagCode}.png`} 
                  alt={l.label} 
                  style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', flexShrink: 0 }} 
                />
                <span>{l.label}</span>
              </div>
              {language === l.id && <Check size={14} style={{ color: 'var(--accent-cyan)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
