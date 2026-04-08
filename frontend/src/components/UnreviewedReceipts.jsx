import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, Trash2, ChevronDown, ChevronUp, X, ZoomIn, Calendar, Hash, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7051';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Lightbox({ files, initialIndex, onClose }) {
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, files.length - 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [files.length, onClose]);

  const file = files[idx];
  const imgUrl = `${API_BASE}${file.url}`;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}><X size={24} /></button>
        <img src={imgUrl} alt={file.original_filename} className="lightbox-image" />
        <div className="lightbox-footer">
          <span>{idx + 1} / {files.length}</span>
          {files.length > 1 && (
            <div className="lightbox-nav">
              <button disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>←</button>
              <button disabled={idx === files.length - 1} onClick={() => setIdx(i => i + 1)}>→</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session, onDelete, onDeleteItem }) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteSession = async () => {
    if (!window.confirm(`Удалить загрузку из ${formatDate(session.uploaded_at)} (${session.count} чек(а))?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/receipt-uploads/${session.session_id}`);
      onDelete(session.session_id);
    } catch (e) {
      alert('Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm('Удалить этот чек?')) return;
    try {
      await api.delete(`/api/receipt-uploads/item/${item.id}`);
      onDeleteItem(session.session_id, item.id);
    } catch (e) {
      alert('Ошибка удаления');
    }
  };

  return (
    <div className={`session-card ${expanded ? 'expanded' : ''}`}>
      <div className="session-header" onClick={() => setExpanded(v => !v)}>
        <div className="session-meta">
          <span className="session-date">
            <Calendar size={14} />
            {formatDate(session.uploaded_at)}
          </span>
          <span className="session-badge">
            <Hash size={12} />
            {session.count} {session.count === 1 ? 'чек' : session.count < 5 ? 'чека' : 'чеков'}
          </span>
          {session.telegram_chat_id && (
            <span className="session-chat-id">chat: {session.telegram_chat_id}</span>
          )}
        </div>
        <div className="session-actions" onClick={e => e.stopPropagation()}>
          <button
            className="btn-icon btn-danger"
            onClick={handleDeleteSession}
            disabled={deleting}
            title="Удалить всю загрузку"
          >
            <Trash2 size={16} />
          </button>
          <button className="btn-icon btn-ghost" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="session-files">
          {session.files.map((file, i) => (
            <div key={file.id} className="receipt-thumb-container">
              <div
                className="receipt-thumb"
                onClick={() => setLightboxIdx(i)}
                title="Открыть"
              >
                <img
                  src={`${API_BASE}${file.url}`}
                  alt={file.original_filename}
                  loading="lazy"
                />
                <div className="receipt-thumb-overlay">
                  <ZoomIn size={22} />
                </div>
              </div>
              <button
                className="receipt-thumb-delete"
                onClick={() => handleDeleteItem(file)}
                title="Удалить"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox
          files={session.files}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

export default function UnreviewedReceipts() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/receipt-uploads');
      setSessions(res.data);
    } catch (e) {
      setError('Не удалось загрузить данные.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (sessionId) => {
    setSessions(prev => prev.filter(s => s.session_id !== sessionId));
  };

  const handleDeleteItem = (sessionId, itemId) => {
    setSessions(prev => prev.map(s => {
      if (s.session_id !== sessionId) return s;
      const newFiles = s.files.filter(f => f.id !== itemId);
      if (newFiles.length === 0) return null; // will be filtered out
      return { ...s, files: newFiles, count: newFiles.length };
    }).filter(Boolean));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <Inbox size={28} className="page-icon" />
          <div>
            <h1 className="page-title">Неразобранные чеки</h1>
            <p className="page-subtitle">
              Фото, загруженные через Telegram-бота командой <strong>«чек»</strong>
            </p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Обновить
        </button>
      </div>

      {/* How-to hint */}
      <div className="hint-box">
        <span>💡</span>
        <span>
          Напишите боту слово <strong>чек</strong> — он откроет 10-минутное окно.
          Отправляйте фото чеков, они сохранятся здесь. Несколько фото за раз — одна загрузка.
        </span>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <span>Загрузка...</span>
        </div>
      )}

      {error && (
        <div className="error-state">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="empty-state">
          <Inbox size={56} className="empty-icon" />
          <h3>Нет неразобранных чеков</h3>
          <p>Напишите боту «чек» и отправьте фото — они появятся здесь.</p>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="sessions-list">
          {sessions.map(session => (
            <SessionCard
              key={session.session_id}
              session={session}
              onDelete={handleDelete}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
