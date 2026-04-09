import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Save, Trash2, X, Plus, Tags, Folder, ChevronDown, ChevronRight, Check } from 'lucide-react';
import api from '../api';

/* ─── small inline-edit input ───────────────────────────────── */
function InlineInput({ value, onSave, onCancel }) {
  const [val, setVal] = useState(value);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const submit = () => { if (val.trim() && val.trim() !== value) onSave(val.trim()); else onCancel(); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        className="cat-inline-input"
      />
      <button onClick={submit} className="btn-icon cat-action-btn cat-action-save" title="Сохранить">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="btn-icon cat-action-btn cat-action-cancel" title="Отмена">
        <X size={14} />
      </button>
    </div>
  );
}

/* ─── group pill badge ───────────────────────────────────────── */
function GroupBadge({ groupName }) {
  if (!groupName) return <span className="cat-badge cat-badge-none">Без группы</span>;
  return <span className="cat-badge">{groupName}</span>;
}

/* ─── main component ─────────────────────────────────────────── */
const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // group editing
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);

  // category editing
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatGroupId, setEditCatGroupId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroupId, setNewCatGroupId] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  // expanded groups in the grouped view
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  /* ── fetch ── */
  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, grpRes] = await Promise.all([api.get('/categories'), api.get('/categories/groups')]);
      setCategories(catRes.data);
      setGroups(grpRes.data);
      setExpandedGroups(new Set(grpRes.data.map(g => g.id)));
    } catch (err) {
      setError(`Ошибка загрузки: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  /* ─── Group handlers ─── */
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    setError('');
    try {
      const res = await api.post('/categories/groups', { name: newGroupName.trim() });
      if (!groups.find(g => g.id === res.data.id)) {
        const updated = [...groups, res.data].sort((a, b) => a.name.localeCompare(b.name));
        setGroups(updated);
        setExpandedGroups(prev => new Set([...prev, res.data.id]));
      }
      setNewGroupName('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось создать группу.');
    } finally {
      setAddingGroup(false);
    }
  };

  const handleRenameGroup = async (id, name) => {
    setError('');
    try {
      const res = await api.patch(`/categories/groups/${id}`, { name });
      setGroups(prev => prev.map(g => g.id === id ? { ...g, name: res.data.name } : g).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingGroupId(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось переименовать группу.');
    }
  };

  const handleDeleteGroup = async (id, name) => {
    if (!window.confirm(`Удалить группу «${name}»? Категории будут откреплены.`)) return;
    try {
      await api.delete(`/categories/groups/${id}`);
      setGroups(prev => prev.filter(g => g.id !== id));
      setCategories(prev => prev.map(c => c.group_id === id ? { ...c, group_id: null } : c));
    } catch (err) {
      setError('Не удалось удалить группу.');
    }
  };

  /* ─── Category handlers ─── */
  const handleCreateCat = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setAddingCat(true);
    setError('');
    try {
      const payload = { name: newCatName.trim() };
      if (newCatGroupId) payload.group_id = parseInt(newCatGroupId);
      const res = await api.post('/categories', payload);
      if (!categories.find(c => c.id === res.data.id)) {
        setCategories(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setNewCatName('');
      setNewCatGroupId('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось создать категорию.');
    } finally {
      setAddingCat(false);
    }
  };

  const handleSaveEditCat = async (id) => {
    if (!editCatName.trim()) return;
    setError('');
    try {
      const payload = { name: editCatName.trim(), group_id: editCatGroupId ? parseInt(editCatGroupId) : -1 };
      const res = await api.patch(`/categories/${id}`, payload);
      setCategories(prev =>
        prev.map(c => c.id === id ? { ...c, name: res.data.name, group_id: res.data.group_id } : c)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingCatId(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось обновить категорию.');
    }
  };

  const handleQuickGroupChange = async (catId, newGrpId) => {
    try {
      const payload = { group_id: newGrpId ? parseInt(newGrpId) : -1 };
      const res = await api.patch(`/categories/${catId}`, payload);
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, group_id: res.data.group_id } : c));
    } catch (err) {
      setError('Не удалось изменить группу.');
    }
  };

  const handleDeleteCat = async (id, name) => {
    if (!window.confirm(`Удалить категорию «${name}»? Транзакции станут некатегоризированными.`)) return;
    setError('');
    try {
      await api.delete(`/categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError('Не удалось удалить категорию.');
    }
  };

  const startEditCat = (cat) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatGroupId(cat.group_id || '');
  };

  const toggleGroup = (id) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ─── build grouped view ─── */
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g.name]));

  const catsByGroup = groups.map(g => ({
    ...g,
    cats: categories.filter(c => c.group_id === g.id),
  }));
  const ungrouped = categories.filter(c => !c.group_id);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка…</div>;

  return (
    <div className="cat-page">
      <div className="page-header">
        <div className="page-title-group">
          <Tags size={28} className="page-icon" />
          <div>
            <h1 className="page-title">Categories &amp; Groups Editor</h1>
            <p className="page-subtitle">Управление категориями и группами расходов</p>
          </div>
        </div>
      </div>

      {error && <div className="error-state" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <div className="cat-layout">
        {/* ══ LEFT: Groups panel ══ */}
        <div className="card cat-panel">
          <div className="cat-panel-header">
            <Folder size={18} color="var(--primary)" />
            <span>Группы категорий</span>
          </div>
          <p className="cat-panel-hint">Группы объединяют категории в разделах аналитики.</p>

          {/* add group form */}
          <form onSubmit={handleCreateGroup} className="cat-add-form">
            <input
              className="cat-input"
              placeholder="Новая группа…"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary cat-add-btn" disabled={addingGroup || !newGroupName.trim()}>
              <Plus size={15} />
            </button>
          </form>

          {/* groups list */}
          <div className="cat-list">
            {groups.length === 0 && (
              <div className="cat-empty">Нет групп</div>
            )}
            {groups.map(grp => (
              <div key={grp.id} className="cat-group-item">
                {editingGroupId === grp.id ? (
                  <InlineInput
                    value={grp.name}
                    onSave={name => handleRenameGroup(grp.id, name)}
                    onCancel={() => setEditingGroupId(null)}
                  />
                ) : (
                  <>
                    <div className="cat-group-name">
                      <Folder size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <span>{grp.name}</span>
                      <span className="cat-group-count">{categories.filter(c => c.group_id === grp.id).length}</span>
                    </div>
                    <div className="cat-row-actions">
                      <button
                        className="btn-icon cat-action-btn"
                        title="Переименовать"
                        onClick={() => setEditingGroupId(grp.id)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn-icon cat-action-btn cat-action-delete"
                        title="Удалить группу"
                        onClick={() => handleDeleteGroup(grp.id, grp.name)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT: Categories panel ══ */}
        <div className="card cat-panel cat-panel-wide">
          <div className="cat-panel-header">
            <Tags size={18} color="var(--primary)" />
            <span>Категории</span>
            <span className="cat-count-badge">{categories.length}</span>
          </div>

          {/* add category form */}
          <form onSubmit={handleCreateCat} className="cat-add-form cat-add-form-wide">
            <input
              className="cat-input"
              placeholder="Название новой категории…"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
            />
            <select
              className="cat-select"
              value={newCatGroupId}
              onChange={e => setNewCatGroupId(e.target.value)}
            >
              <option value="">Без группы</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button type="submit" className="btn btn-primary cat-add-btn" disabled={addingCat || !newCatName.trim()}>
              <Plus size={15} /> Добавить
            </button>
          </form>

          {/* grouped categories view */}
          <div className="cat-list">
            {/* categories by group */}
            {catsByGroup.map(grp => (
              <div key={grp.id} className="cat-group-section">
                <div className="cat-group-section-header" onClick={() => toggleGroup(grp.id)}>
                  <span className="cat-group-section-chevron">
                    {expandedGroups.has(grp.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <Folder size={14} color="var(--primary)" />
                  <span className="cat-group-section-name">{grp.name}</span>
                  <span className="cat-group-count">{grp.cats.length}</span>
                </div>

                {expandedGroups.has(grp.id) && grp.cats.map(cat => (
                  <CatRow
                    key={cat.id}
                    cat={cat}
                    groups={groups}
                    groupMap={groupMap}
                    isEditing={editingCatId === cat.id}
                    editCatName={editCatName}
                    editCatGroupId={editCatGroupId}
                    setEditCatName={setEditCatName}
                    setEditCatGroupId={setEditCatGroupId}
                    onEdit={() => startEditCat(cat)}
                    onSave={() => handleSaveEditCat(cat.id)}
                    onCancel={() => setEditingCatId(null)}
                    onDelete={() => handleDeleteCat(cat.id, cat.name)}
                    onGroupChange={gid => handleQuickGroupChange(cat.id, gid)}
                  />
                ))}
              </div>
            ))}

            {/* Ungrouped */}
            {ungrouped.length > 0 && (
              <div className="cat-group-section">
                <div className="cat-group-section-header" onClick={() => toggleGroup('none')}>
                  <span className="cat-group-section-chevron">
                    {expandedGroups.has('none') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span className="cat-group-section-name" style={{ color: 'var(--text-muted)' }}>Без группы</span>
                  <span className="cat-group-count">{ungrouped.length}</span>
                </div>
                {expandedGroups.has('none') && ungrouped.map(cat => (
                  <CatRow
                    key={cat.id}
                    cat={cat}
                    groups={groups}
                    groupMap={groupMap}
                    isEditing={editingCatId === cat.id}
                    editCatName={editCatName}
                    editCatGroupId={editCatGroupId}
                    setEditCatName={setEditCatName}
                    setEditCatGroupId={setEditCatGroupId}
                    onEdit={() => startEditCat(cat)}
                    onSave={() => handleSaveEditCat(cat.id)}
                    onCancel={() => setEditingCatId(null)}
                    onDelete={() => handleDeleteCat(cat.id, cat.name)}
                    onGroupChange={gid => handleQuickGroupChange(cat.id, gid)}
                  />
                ))}
              </div>
            )}

            {categories.length === 0 && (
              <div className="cat-empty">Категорий пока нет</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── category row component ─────────────────────────────────── */
function CatRow({ cat, groups, groupMap, isEditing, editCatName, editCatGroupId,
  setEditCatName, setEditCatGroupId, onEdit, onSave, onCancel, onDelete, onGroupChange }) {

  return (
    <div className={`cat-row${isEditing ? ' cat-row-editing' : ''}`}>
      {isEditing ? (
        <>
          <input
            className="cat-inline-input"
            value={editCatName}
            autoFocus
            onChange={e => setEditCatName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
          />
          <select
            className="cat-select cat-select-sm"
            value={editCatGroupId}
            onChange={e => setEditCatGroupId(e.target.value)}
          >
            <option value="">Без группы</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="cat-row-actions">
            <button className="btn-icon cat-action-btn cat-action-save" title="Сохранить" onClick={onSave}>
              <Save size={14} />
            </button>
            <button className="btn-icon cat-action-btn cat-action-cancel" title="Отмена" onClick={onCancel}>
              <X size={14} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="cat-row-name">
            <Tags size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
            <span>{cat.name}</span>
          </div>
          <select
            className="cat-select cat-select-sm cat-group-select"
            value={cat.group_id || ''}
            onChange={e => onGroupChange(e.target.value)}
            title="Привязать к группе"
          >
            <option value="">Без группы</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="cat-row-actions">
            <button className="btn-icon cat-action-btn" title="Переименовать" onClick={onEdit}>
              <Edit2 size={14} />
            </button>
            <button className="btn-icon cat-action-btn cat-action-delete" title="Удалить" onClick={onDelete}>
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Categories;
