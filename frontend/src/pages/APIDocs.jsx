import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { BookOpen, HelpCircle, ChevronDown, ChevronUp, Key, Play, Shield } from 'lucide-react';

export default function APIDocs() {
  const { t, theme, language } = useSettings();
  const [showGuide, setShowGuide] = useState(true);
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    const mainEl = document.querySelector('.main-content');
    if (mainEl) {
      mainEl.style.setProperty('padding-bottom', '0px', 'important');
      mainEl.style.setProperty('height', '100vh', 'important');
      mainEl.style.setProperty('height', '100dvh', 'important');
      mainEl.style.setProperty('overflow', 'hidden', 'important');
    }
    return () => {
      if (mainEl) {
        mainEl.style.removeProperty('padding-bottom');
        mainEl.style.removeProperty('height');
        mainEl.style.removeProperty('overflow');
      }
    };
  }, []);

  useEffect(() => {
    setLoaded(false);
  }, [theme]);

  const desc = t('api_docs_desc_page');
  const cleanDesc = (!desc || desc === 'api_docs_desc_page') ? 'M-Panel API entegrasyonu için interaktif Swagger dokümantasyonu.' : desc;

  const isTr = language === 'tr';

  return (
    <div className="api-docs-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', minHeight: 0, flex: 1 }}>
      
      {/* Header and Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', margin: 0 }}>
            <BookOpen size={20} style={{ color: 'var(--accent-cyan)' }} />
            {t('api_docs') || 'API Belgeleri'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.35rem', margin: '0.35rem 0 0 0' }}>
            {cleanDesc}
          </p>
        </div>
        
        {/* Toggle Guide Button */}
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="badge"
          style={{
            padding: '0.45rem 1rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            border: '1px solid var(--border-color)',
            background: showGuide ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.04)',
            color: showGuide ? '#0a0f1d' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderRadius: '9999px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <HelpCircle size={14} />
          {isTr ? 'Kullanım Kılavuzu' : 'User Guide'}
          {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* API Usage Guide Card */}
      {showGuide && (
        <div className="glass-card animate-fade-in" style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-secondary)', borderRadius: '16px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Shield size={16} style={{ color: 'var(--accent-cyan)' }} />
            {isTr ? 'API Entegrasyon ve Kullanım Kılavuzu' : 'API Integration & Usage Guide'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', fontSize: '0.8rem', lineHeight: '1.4' }}>
            {/* Step 1 */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: '700' }}>1</div>
              <div>
                <h4 style={{ fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Key size={12} />
                  {isTr ? 'API Anahtarı Edinin' : 'Get API Key'}
                </h4>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  {isTr 
                    ? 'API Anahtarları sayfasından işlem türünüze uygun yetkide bir anahtar oluşturup güvenli bir yere kopyalayın.' 
                    : 'Create an access key with appropriate permissions on the API Keys page and copy it safely.'}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: '700' }}>2</div>
              <div>
                <h4 style={{ fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Shield size={12} />
                  {isTr ? 'Kimlik Doğrulama' : 'Authentication'}
                </h4>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  {isTr 
                    ? 'Aşağıdaki Swagger arayüzünde sağ üstteki "Authorize" butonuna basın. Değer kutusuna "Bearer <kopyalanan_anahtar>" yazarak doğrulayın.' 
                    : 'Click "Authorize" at the top-right of Swagger below. Paste "Bearer <your_copied_key>" into the input box to authorize.'}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: '700' }}>3</div>
              <div>
                <h4 style={{ fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Play size={12} />
                  {isTr ? 'Test ve Çalıştırma' : 'Interactive Testing'}
                </h4>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  {isTr 
                    ? 'İstediğiniz endpoint\'e tıklayıp "Try it out" butonuna basın. Gerekli parametreleri girip "Execute" ederek canlı sonuçları izleyin.' 
                    : 'Click any endpoint and hit "Try it out". Input required parameters and click "Execute" to see live API responses.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Swagger UI Iframe - Boxless and Transparent */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          body.swagger-modal-open,
          body.swagger-modal-open html,
          body.swagger-modal-open .main-content {
            overflow: hidden !important;
            height: 100vh !important;
            height: 100dvh !important;
          }
          body.swagger-modal-open .api-docs-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            height: 100dvh !important;
            z-index: 999999 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            box-sizing: border-box !important;
            gap: 0 !important;
          }
          body.swagger-modal-open.sidebar-collapsed .api-docs-container {
            left: 0 !important;
          }
          body.swagger-modal-open .api-docs-container > div:last-child {
            height: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body.swagger-modal-open .main-content .animate-fade-in {
            transform: none !important;
            animation: none !important;
          }
          @media (max-width: 1024px) {
            body.swagger-modal-open .api-docs-container {
              left: 0 !important;
            }
          }
          body.swagger-modal-open .api-docs-container > div:first-child,
          body.swagger-modal-open .api-docs-container > .glass-card {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          .api-docs-container > div:first-child,
          .api-docs-container > .glass-card {
            transition: all 0.3s ease !important;
          }
        `}</style>
        
        {!loaded && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'var(--bg-primary, #0b0f19)',
            zIndex: 10,
            gap: '1rem',
            borderRadius: '16px'
          }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid rgba(6, 182, 212, 0.1)', 
              borderTop: '3px solid var(--accent-cyan)', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '500' }}>
              {isTr ? 'API Belgeleri Yükleniyor...' : 'Loading API Docs...'}
            </span>
          </div>
        )}

        <iframe 
          src={`/api/docs?theme=${theme || 'dark'}`} 
          title="API Documentation" 
          onLoad={() => setLoaded(true)}
          style={{ 
            width: '100%', 
            height: '100%', 
            border: 'none',
            background: 'transparent',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
        />
      </div>
    </div>
  );
}


