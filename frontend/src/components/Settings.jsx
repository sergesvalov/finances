import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import api from '../api';

const Settings = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/settings').then(res => {
      setToken(res.data.telegram_bot_token || '');
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.post('/settings', { telegram_bot_token: token });
      setMessage('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Administration...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Administration</h1>
      </div>
      
      <div className="card" style={{ maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>General Settings</h3>
        
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-muted)' }}>
              Telegram Bot Token
            </label>
            <input 
              type="text" 
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:ABCDefghIJKLmnopQRSTuvwxYZ"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                color: 'white',
                outline: 'none'
              }}
            />
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Enter the bot token provided by @BotFather to enable future telegram integrations.
            </p>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={saving}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          
          {message && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: message.includes('Failed') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: message.includes('Failed') ? 'var(--danger)' : 'var(--success)', textAlign: 'center' }}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Settings;
