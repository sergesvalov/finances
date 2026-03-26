import React, { useState, useEffect } from 'react';
import { Save, Trash2, Plus } from 'lucide-react';
import api from '../api';

const Settings = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [recipients, setRecipients] = useState([]);
  const [newRecId, setNewRecId] = useState('');
  const [newRecName, setNewRecName] = useState('');
  const [addingRec, setAddingRec] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/settings'),
      api.get('/recipients')
    ]).then(([settingsRes, recipientsRes]) => {
      setToken(settingsRes.data.telegram_bot_token || '');
      setRecipients(recipientsRes.data);
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

  const handleAddRecipient = async (e) => {
    e.preventDefault();
    if (!newRecId || !newRecName) return;
    setAddingRec(true);
    try {
      const res = await api.post('/recipients', { telegram_id: newRecId, name: newRecName });
      setRecipients([...recipients, res.data]);
      setNewRecId('');
      setNewRecName('');
    } catch(err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to add recipient");
    } finally {
      setAddingRec(false);
    }
  };

  const handleRemoveRecipient = async (id) => {
    if (!window.confirm("Remove this recipient?")) return;
    try {
      await api.delete(`/recipients/${id}`);
      setRecipients(recipients.filter(r => r.id !== id));
    } catch(err) {
      console.error(err);
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

      <div className="card" style={{ maxWidth: '600px', marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Report Recipients</h3>
        
        <div style={{ marginBottom: '1.5rem' }}>
          {recipients.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>No recipients added yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {recipients.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: '500' }}>{r.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {r.telegram_id}</div>
                  </div>
                  <button onClick={() => handleRemoveRecipient(r.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <form onSubmit={handleAddRecipient} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input 
              type="text" 
              placeholder="Name (e.g. John Doe)" 
              value={newRecName}
              onChange={(e) => setNewRecName(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'white', outline: 'none', marginBottom: '0.5rem' }}
              required
            />
            <input 
              type="text" 
              placeholder="Telegram ID" 
              value={newRecId}
              onChange={(e) => setNewRecId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'white', outline: 'none' }}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={addingRec} style={{ height: 'auto', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <Plus size={18} />
            Add
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
