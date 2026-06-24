import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { Settings, Shield, Bell, Link, Save, Download, Key, ShieldAlert, Check, AlertTriangle, Send } from 'lucide-react';

export default function SettingsPage() {
  const { t, showToast } = useSettings();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // General Settings States
  const [sessionTimeout, setSessionTimeout] = useState('1440');
  
  // Auth Password Change States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  // 2FA TOTP States
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifyError, setOtpVerifyError] = useState('');

  // Telegram Bot States
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramNotifyCritical, setTelegramNotifyCritical] = useState(true);
  const [telegramNotifyExpiry, setTelegramNotifyExpiry] = useState(true);
  const [testingTelegram, setTestingTelegram] = useState(false);

  // Subscription Settings States
  const [subLinkPrefix, setSubLinkPrefix] = useState('');

  // Update Settings States
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [changelogData, setChangelogData] = useState(null);
  const [loadingChangelog, setLoadingChangelog] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);

  useEffect(() => {
    fetchSettings();
    handleCheckUpdate(true);
    checkCurrentUpdateStatus();
  }, []);

  useEffect(() => {
    let interval = null;
    if (pollingActive) {
      interval = setInterval(async () => {
        try {
          const statusData = await api.getUpdateStatus();
          setUpdateStatus(statusData);
          
          if (statusData.completed) {
            setPollingActive(false);
            showToast(t('update_success') || 'Güncelleme başarıyla tamamlandı! Sayfa yenileniyor...', 'success');
            setTimeout(() => {
              window.location.reload();
            }, 5000);
          } else if (statusData.error) {
            setPollingActive(false);
            setUpdateError(statusData.error);
            setUpdating(false);
            showToast(statusData.error || 'Güncelleme sırasında bir hata oluştu.', 'error');
          }
        } catch (err) {
          // Network errors are ignored during service restarts
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pollingActive]);

  const handleCheckUpdate = async (silent = false) => {
    if (!silent) setCheckingUpdate(true);
    try {
      const data = await api.checkUpdate();
      setUpdateInfo(data);
      if (!silent && !data.update_available) {
        showToast(t('no_update_available') || 'Paneliniz zaten güncel.', 'success');
      }
    } catch (err) {
      if (!silent) showToast(err.message, 'error');
    } finally {
      if (!silent) setCheckingUpdate(false);
    }
  };

  const checkCurrentUpdateStatus = async () => {
    try {
      const statusData = await api.getUpdateStatus();
      if (statusData && statusData.in_progress) {
        setUpdating(true);
        setUpdateStatus(statusData);
        setPollingActive(true);
      }
    } catch (err) {
      // Ignore
    }
  };

  const handleFetchChangelog = async () => {
    setLoadingChangelog(true);
    try {
      const data = await api.getUpdateChangelog();
      setChangelogData(data);
      setShowChangelogModal(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingChangelog(false);
    }
  };

  const handleStartUpdate = async (version) => {
    setShowChangelogModal(false);
    setUpdating(true);
    setUpdateError(null);
    setUpdateStatus({
      in_progress: true,
      current_step: 0,
      total_steps: 7,
      step_label: 'Güncelleme hazırlanıyor...',
      completed: false,
      error: null
    });
    
    try {
      await api.applyUpdate(version);
      setPollingActive(true);
    } catch (err) {
      setUpdating(false);
      setUpdateError(err.message);
      showToast(err.message, 'error');
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      if (data) {
        setSessionTimeout(data.session_timeout || '1440');
        setTelegramBotToken(data.telegram_bot_token || '');
        setTelegramChatId(data.telegram_chat_id || '');
        setTelegramNotifyCritical(data.telegram_notify_critical === 'true');
        setTelegramNotifyExpiry(data.telegram_notify_expiry === 'true');
        setSubLinkPrefix(data.sub_link_prefix || '');
        setTwoFactorEnabled(data.two_factor_enabled || false);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = [
        { key: 'session_timeout', value: String(sessionTimeout) },
        { key: 'telegram_bot_token', value: telegramBotToken },
        { key: 'telegram_chat_id', value: telegramChatId },
        { key: 'telegram_notify_critical', value: String(telegramNotifyCritical) },
        { key: 'telegram_notify_expiry', value: String(telegramNotifyExpiry) },
        { key: 'sub_link_prefix', value: subLinkPrefix }
      ];
      await api.updateSettings(payload);
      showToast(t('settings_saved') || 'Ayarlar başarıyla kaydedildi.', 'success');
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      showToast(t('password_mismatch') || 'Yeni şifreler eşleşmiyor.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword });
      showToast(t('password_changed_success') || 'Şifre başarıyla değiştirildi.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      showToast('Yedek hazırlanıyor, lütfen bekleyin...', 'info');
      await api.downloadBackup();
      showToast('Yedek başarıyla indirildi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleInit2FA = async () => {
    try {
      const data = await api.setup2FA();
      setSetupData(data);
      setShow2FAModal(true);
      setOtpCode('');
      setOtpVerifyError('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleEnable2FA = async () => {
    if (otpCode.length !== 6) {
      setOtpVerifyError('Lütfen 6 haneli kodu eksiksiz girin.');
      return;
    }
    try {
      await api.enable2FA(otpCode);
      showToast('2FA başarıyla etkinleştirildi.', 'success');
      setShow2FAModal(false);
      fetchSettings();
    } catch (err) {
      setOtpVerifyError(err.message || 'Hatalı kod.');
    }
  };

  const handleDisable2FA = async () => {
    const code = window.prompt('2FA\'yı devre dışı bırakmak için doğrulama uygulamanızdaki 6 haneli kodu girin:');
    if (!code) return;
    try {
      await api.disable2FA(code);
      showToast('2FA başarıyla devre dışı bırakıldı.', 'success');
      fetchSettings();
    } catch (err) {
      showToast(err.message || 'Hatalı kod, 2FA devre dışı bırakılamadı.', 'error');
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    try {
      await api.testTelegram();
      showToast(t('telegram_test_success') || 'Test mesajı Telegram\'a gönderildi!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTestingTelegram(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        {t('loading') || 'Yükleniyor...'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      
      {/* Settings Header */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', margin: 0 }}>
          <Settings size={20} style={{ color: 'var(--accent-cyan)' }} />
          {t('settings_title') || 'Panel Ayarları'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          {t('settings_desc') || 'Sistem ayarları, kimlik doğrulama, bildirimler ve abonelik yapılandırması.'}
        </p>
      </div>

      {/* Tabs navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.5rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }} className="no-scrollbar">
        {[
          { id: 'general', label: t('tab_general') || 'Genel', icon: <Settings size={16} /> },
          { id: 'auth', label: t('tab_auth') || 'Kimlik Doğrulama', icon: <Shield size={16} /> },
          { id: 'telegram', label: t('tab_telegram') || 'Telegram Bot', icon: <Bell size={16} /> },
          { id: 'subscription', label: t('tab_subscription') || 'Abonelik', icon: <Link size={16} /> },
          { id: 'update', label: t('tab_update') || 'Güncelleme', icon: <Download size={16} /> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="badge"
            style={{
              padding: '0.5rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              border: '1px solid var(--border-color)',
              background: activeTab === tab.id ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === tab.id ? '#0a0f1d' : 'var(--text-secondary)',
              cursor: 'pointer',
              borderRadius: '9999px',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === tab.id ? '0 0 10px rgba(6, 182, 212, 0.25)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      <div className="glass-card settings-card" style={{ padding: '2rem' }}>
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', boxSizing: 'border-box' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {t('session_timeout_label') || 'Oturum Zaman Aşımı (Dakika)'}
              </label>
              <input 
                type="number" 
                className="form-input" 
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                required
                style={{ maxWidth: '300px', width: '100%' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {t('session_timeout_desc') || 'Yönetici oturumunun aktif kalacağı süreyi belirler (varsayılan: 1440 dakika / 24 saat).'}
              </p>
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: 0 }} />

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {t('backup_btn') || 'Veritabanı ve Yapılandırma Yedekleme'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {t('backup_desc') || 'Sistem veritabanını (panel.db) ve Xray bağlantı ayarlarını (config.json) içeren bir ZIP arşivi yedekler.'}
              </p>
              <button 
                type="button" 
                onClick={handleDownloadBackup}
                className="btn-secondary" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1rem' }}
              >
                <Download size={16} />
                {t('backup_btn') || 'Yedek Oluştur ve İndir'}
              </button>
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: 0 }} />

            <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
              <Save size={16} />
              {saving ? t('saving') : (t('save') || 'Değişiklikleri Kaydet')}
            </button>
          </form>
        )}

        {/* AUTH TAB */}
        {activeTab === 'auth' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', width: '100%', boxSizing: 'border-box' }}>
            
            {/* Password Change Form */}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '500px', width: '100%', boxSizing: 'border-box' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                <Key size={18} style={{ color: 'var(--accent-cyan)' }} />
                {t('change_password_title') || 'Admin Şifresini Değiştir'}
              </h3>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  {t('current_password') || 'Mevcut Şifre'}
                </label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  {t('new_password') || 'Yeni Şifre'}
                </label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  {t('new_password_confirm') || 'Yeni Şifre Tekrar'}
                </label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                <Save size={16} />
                {saving ? t('saving') : (t('save') || 'Şifreyi Güncelle')}
              </button>
            </form>

            <hr style={{ borderColor: 'var(--border-color)', margin: 0 }} />

            {/* 2FA Section */}
            <div style={{ maxWidth: '600px', width: '100%' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <Shield size={18} style={{ color: 'var(--accent-cyan)' }} />
                {t('two_factor_title') || 'İki Faktörlü Kimlik Doğrulama (2FA - TOTP)'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                {t('two_factor_desc') || 'Yönetici hesabı girişinde Google Authenticator veya uyumlu bir TOTP doğrulaması şart koşarak güvenliği üst düzeye çıkarın.'}
              </p>

              <div className="two-factor-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  padding: '0.35rem 0.75rem', 
                  borderRadius: '30px', 
                  fontSize: '0.75rem', 
                  fontWeight: '700', 
                  background: twoFactorEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: twoFactorEnabled ? '#10b981' : '#ef4444',
                  border: twoFactorEnabled ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)'
                }}>
                  {twoFactorEnabled ? (t('two_factor_status_active') || '2FA AKTİF') : (t('two_factor_status_inactive') || '2FA DEVRE DIŞI')}
                </div>

                {twoFactorEnabled ? (
                  <button 
                    onClick={handleDisable2FA}
                    className="btn-secondary" 
                    style={{ padding: '0.5rem 1rem', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                  >
                    {t('disable_2fa_btn') || '2FA Devre Dışı Bırak'}
                  </button>
                ) : (
                  <button 
                    onClick={handleInit2FA}
                    className="btn-primary" 
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {t('enable_2fa_btn') || '2FA Aktif Et'}
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TELEGRAM TAB */}
        {activeTab === 'telegram' && (
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', width: '100%', boxSizing: 'border-box' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                {t('telegram_bot_token_label') || 'Telegram Bot Token'}
              </label>
              <input 
                type="password" 
                className="form-input" 
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="Örn: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                {t('telegram_chat_id_label') || 'Telegram Chat ID'}
              </label>
              <input 
                type="text" 
                className="form-input" 
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Örn: -100123456789 veya 987654321"
              />
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                {t('notification_triggers') || 'Bildirim Tetikleyicileri'}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', width: '100%' }}>
                  <input 
                    type="checkbox" 
                    checked={telegramNotifyCritical}
                    onChange={(e) => setTelegramNotifyCritical(e.target.checked)}
                    style={{ marginTop: '0.2rem', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {t('telegram_notify_critical_label') || 'Kritik Sistem Bildirimleri'}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-word', marginTop: '0.15rem' }}>
                      {t('telegram_notify_critical_desc') || 'Sunucu CPU veya RAM kullanımı %90\'ı aştığında Telegram üzerinden uyar.'}
                    </span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', width: '100%' }}>
                  <input 
                    type="checkbox" 
                    checked={telegramNotifyExpiry}
                    onChange={(e) => setTelegramNotifyExpiry(e.target.checked)}
                    style={{ marginTop: '0.2rem', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {t('telegram_notify_expiry_label') || 'Kullanıcı Kota/Süre Bildirimleri'}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-word', marginTop: '0.15rem' }}>
                      {t('telegram_notify_expiry_desc') || 'Kullanıcıların süresi veya kotası dolup hesapları kapandığında bildirim gönder.'}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                <Save size={16} />
                {saving ? t('saving') : (t('save') || 'Ayarları Kaydet')}
              </button>

              <button 
                type="button" 
                onClick={handleTestTelegram}
                disabled={testingTelegram || !telegramBotToken || !telegramChatId}
                className="btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
              >
                <Send size={16} />
                {testingTelegram ? 'Gönderiliyor...' : (t('send_test_msg_btn') || 'Test Mesajı Gönder')}
              </button>
            </div>
          </form>
        )}

        {/* SUBSCRIPTION TAB */}
        {activeTab === 'subscription' && (
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', width: '100%', boxSizing: 'border-box' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                {t('sub_link_prefix_label') || 'Abonelik Linki Ön Eki (Prefix URL)'}
              </label>
              <input 
                type="text" 
                className="form-input" 
                value={subLinkPrefix}
                onChange={(e) => setSubLinkPrefix(e.target.value)}
                placeholder="Örn: https://abone.mehmetaymaz.com.tr"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: '1.4' }}>
                {t('sub_link_prefix_desc') || 'Kullanıcılara kopyalanan abonelik (VLESS/Subscription) linklerinin başlangıç adresidir. Boş bırakılırsa panelin mevcut adresi ve portu kullanılır.'}
              </p>
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

            <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
              <Save size={16} />
              {saving ? t('saving') : (t('save') || 'Ayarları Kaydet')}
            </button>
          </form>
        )}

        {/* UPDATE TAB */}
        {activeTab === 'update' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', boxSizing: 'border-box' }}>
            {updating ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', width: '100%' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <span className="spinner" style={{ display: 'inline-block', width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  {t('updating_panel') || 'Panel Güncelleniyor...'}
                </h3>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {t('update_warning') || 'Lütfen bu işlemi yarıda kesmeyin ve sayfayı kapatmayın. Güncelleme tamamlandığında panel otomatik olarak yeniden başlatılacak.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  {[
                    { step: 1, label: t('update_step_code') || 'Kod güncellendi' },
                    { step: 2, label: t('update_step_deps') || 'Bağımlılıklar güncellendi' },
                    { step: 3, label: t('update_step_db') || 'Veritabanı güncellendi' },
                    { step: 4, label: t('update_step_ui_deps') || 'Arayüz paketleri yüklendi' },
                    { step: 5, label: t('update_step_ui_build') || 'Arayüz derlendi' },
                    { step: 6, label: t('update_step_deploy') || 'Derleme dosyaları kopyalandı' },
                    { step: 7, label: t('update_step_restart') || 'Servis yeniden başlatılıyor...' }
                  ].map(item => {
                    const isCompleted = updateStatus && updateStatus.current_step > item.step;
                    const isCurrent = updateStatus && updateStatus.current_step === item.step;
                    const isPending = updateStatus && updateStatus.current_step < item.step;

                    return (
                      <div key={item.step} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', opacity: isPending ? 0.4 : 1 }}>
                        {isCompleted ? (
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                        ) : isCurrent ? (
                          <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>○</span>
                        )}
                        <span style={{ color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-primary)', fontWeight: isCurrent ? '600' : 'normal' }}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {updateStatus && updateStatus.step_label}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', width: '100%' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <Download size={18} style={{ color: 'var(--accent-cyan)' }} />
                  {t('panel_version_title') || 'Panel Sürüm Yönetimi'}
                </h3>
                
                {updateInfo ? (
                  <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('current_version') || 'Mevcut Sürüm'}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>{updateInfo.current_version}</div>
                      </div>
                      
                      {updateInfo.update_available && (
                        <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('latest_version') || 'Yeni Sürüm'}</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>{updateInfo.latest_version}</div>
                        </div>
                      )}
                    </div>

                    <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

                    {updateInfo.update_available ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: '600' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }} />
                          {t('update_available_msg') || 'Yeni bir güncelleme mevcut! Lütfen sisteminizi güncelleyin.'}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button 
                            type="button" 
                            className="btn-secondary" 
                            onClick={handleFetchChangelog}
                            disabled={loadingChangelog}
                            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                          >
                            {loadingChangelog ? 'Yükleniyor...' : (t('changelog_btn') || 'Değişiklikleri Gör')}
                          </button>
                          <button 
                            type="button" 
                            className="btn-primary" 
                            onClick={() => handleStartUpdate(updateInfo.latest_version)}
                            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                          >
                            {t('update_now_btn') || 'Şimdi Güncelle'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }} />
                          {t('panel_is_up_to_date') || 'Panel sürümünüz güncel.'}
                        </div>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          onClick={() => handleCheckUpdate(false)}
                          disabled={checkingUpdate}
                          style={{ marginTop: '1rem', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                        >
                          {checkingUpdate ? 'Kontrol Ediliyor...' : (t('check_again_btn') || 'Yeniden Kontrol Et')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={() => handleCheckUpdate(false)}
                    disabled={checkingUpdate}
                    style={{ alignSelf: 'flex-start', padding: '0.65rem 1.25rem' }}
                  >
                    {checkingUpdate ? 'Kontrol Ediliyor...' : (t('check_update_btn') || 'Güncelleştirmeleri Denetle')}
                  </button>
                )}

                {updateError && (
                  <div className="error-banner" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
                    <AlertTriangle size={18} />
                    <div>
                      <div style={{ fontWeight: '700' }}>Güncelleme Başarısız:</div>
                      <div style={{ marginTop: '0.25rem', fontFamily: 'monospace' }}>{updateError}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* 2FA SETUP MODAL */}
      {show2FAModal && setupData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card modal-content-custom" style={{ maxWidth: '500px', width: '100%', padding: '2rem', position: 'relative', background: 'var(--bg-modal-solid)' }}>
            
            <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <ShieldAlert size={20} style={{ color: 'var(--accent-cyan)' }} />
              {t('two_factor_modal_title') || 'İki Faktörlü Kimlik Doğrulama Kurulumu'}
            </h3>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '1.5rem' }}>
              {t('two_factor_modal_desc') || 'Aşağıdaki QR kodunu Google Authenticator, Authy veya başka bir 2FA uygulamasıyla taratın.'}
            </p>

            {/* QR Code Container */}
            <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '12px', width: '200px', height: '200px', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupData.otpauth_url)}`} 
                alt="2FA QR Code" 
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* Manual Secret Key */}
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Manuel Giriş Anahtarı (Gizli Anahtar)
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--accent-cyan)', background: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'inline-block', wordBreak: 'break-all' }}>
                {setupData.secret}
              </span>
            </div>

            {otpVerifyError && (
              <div className="error-banner" style={{ marginBottom: '1rem' }}>
                <AlertTriangle size={16} />
                <span>{otpVerifyError}</span>
              </div>
            )}

            {/* Code inputs */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {t('otp_code_label') || 'Doğrulama Kodu'}
              </label>
              <input 
                type="text" 
                className="form-input" 
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '0.25em', maxWidth: '200px', margin: '0 auto' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShow2FAModal(false)}
                style={{ flex: 1, padding: '0.75rem' }}
              >
                {t('cancel') || 'İptal'}
              </button>

              <button 
                className="btn-primary" 
                onClick={handleEnable2FA}
                style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Check size={16} />
                {t('verify_and_enable_btn') || 'Doğrula & Etkinleştir'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CHANGELOG MODAL */}
      {showChangelogModal && changelogData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card modal-content-custom" style={{ maxWidth: '600px', width: '100%', padding: '2rem', position: 'relative', background: 'var(--bg-modal-solid)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            
            <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              {changelogData.version} Changelog ({changelogData.release_date})
            </h3>
            
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
              {changelogData.body || 'Değişiklik geçmişi içeriği boş.'}
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowChangelogModal(false)}
                style={{ flex: 1, padding: '0.75rem' }}
              >
                {t('close') || 'Kapat'}
              </button>

              <button 
                className="btn-primary" 
                onClick={() => handleStartUpdate(changelogData.version)}
                style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Download size={16} />
                {t('update_now_btn') || 'Güncellemeyi Başlat'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
