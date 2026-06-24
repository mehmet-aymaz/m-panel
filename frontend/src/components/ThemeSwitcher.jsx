import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Sun, Moon, Palette, Check } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useSettings();
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

  const themes = [
    { id: 'dark', label: 'Koyu', icon: Moon, color: '#06b6d4' },
    { id: 'light', label: 'Açık', icon: Sun, color: '#0f172a' },
    { id: 'emerald', label: 'Zümrüt', icon: Palette, color: '#10b981' },
    { id: 'nord', label: 'Nord', icon: Palette, color: '#81a1c1' },
    { id: 'midnight', label: 'Gece', icon: Moon, color: '#a855f7' },
    { id: 'sakura', label: 'Sakura', icon: Palette, color: '#ec7299' },
    { id: 'dracula', label: 'Dracula', icon: Palette, color: '#bd93f9' },
    { id: 'cyberpunk', label: 'Neon', icon: Palette, color: '#ff007f' },
    { id: 'slate_emerald', label: 'Slate', icon: Palette, color: '#10b981' },
    { id: 'midnight_gold', label: 'Altın', icon: Moon, color: '#fbbf24' },
    { id: 'arctic_frost', label: 'Buzul', icon: Sun, color: '#38bdf8' },
    { id: 'deep_forest', label: 'Orman', icon: Palette, color: '#a7f3d0' },
  ];

  const currentTheme = themes.find(t => t.id === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

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
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          fontWeight: '600',
          cursor: 'pointer',
          height: '48px',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(12px)',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CurrentIcon size={16} style={{ color: currentTheme.color }} />
          <span>{currentTheme.label}</span>
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
          {themes.map((t) => {
            const IconComponent = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTheme(t.id);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  background: theme === t.id ? 'var(--bg-secondary)' : 'transparent',
                  color: theme === t.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: theme === t.id ? '700' : '500',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconComponent size={14} style={{ color: t.color }} />
                  <span>{t.label}</span>
                </div>
                {theme === t.id && <Check size={14} style={{ color: 'var(--accent-cyan)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
