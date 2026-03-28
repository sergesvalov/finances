import React, { useState, useEffect } from 'react';
import { Edit2, Save, Trash2, X, Plus, Tags, Folder } from 'lucide-react';
import api from '../api';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroupId, setNewCatGroupId] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log("Fetching categories and groups...");
      const [catRes, grpRes] = await Promise.all([
        api.get('/categories'),
        api.get('/categories/groups')
      ]);
      console.log("Categories response count:", catRes.data?.length);
      console.log("Groups response count:", grpRes.data?.length);
      setCategories(catRes.data);
      setGroups(grpRes.data);
    } catch (err) {
      console.error("fetchData error:", err);
      if (err.response) {
        console.error("Error data:", err.response.data);
        console.error("Error status:", err.response.status);
      }
      setError(`Failed to fetch data: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Groups Handlers ---
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    setError('');
    try {
      const res = await api.post('/categories/groups', { name: newGroupName.trim() });
      if (!groups.find(g => g.id === res.data.id)) {
        setGroups([...groups, res.data].sort((a,b) => a.name.localeCompare(b.name)));
      }
      setNewGroupName('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to create group.');
    } finally {
      setAddingGroup(false);
    }
  };

  const handleDeleteGroup = async (id, name) => {
     if (!window.confirm(`Are you sure you want to delete group "${name}"? Categories in it will be ungrouped.`)) return;
     try {
       await api.delete(`/categories/groups/${id}`);
       setGroups(groups.filter(g => g.id !== id));
       // refresh categories to reflect unset group_ids
       const catRes = await api.get('/categories');
       setCategories(catRes.data);
     } catch(err) {
       console.error(err);
       setError('Failed to delete group.');
     }
  };

  // --- Categories Handlers ---
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
        setCategories([...categories, res.data].sort((a,b) => a.name.localeCompare(b.name)));
      }
      setNewCatName('');
      setNewCatGroupId('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to create category.');
    } finally {
      setAddingCat(false);
    }
  };

  const handleStartEditCat = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditGroupId(cat.group_id || '');
  };

  const handleSaveEditCat = async (id) => {
    if (!editName.trim()) return;
    setError('');
    try {
      const payload = { name: editName.trim() };
      payload.group_id = editGroupId ? parseInt(editGroupId) : -1; // -1 to unset in backend
      
      const res = await api.patch(`/categories/${id}`, payload);
      setCategories(categories.map(c => c.id === id ? { ...c, name: res.data.name, group_id: res.data.group_id } : c).sort((a,b) => a.name.localeCompare(b.name)));
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to update category.');
    }
  };

  const handleQuickGroupChange = async (catId, newGroupId) => {
    try {
       const payload = { group_id: newGroupId ? parseInt(newGroupId) : -1 };
       const res = await api.patch(`/categories/${catId}`, payload);
       setCategories(categories.map(c => c.id === catId ? { ...c, group_id: res.data.group_id } : c));
    } catch(err) {
       console.error(err);
    }
  };

  const handleDeleteCat = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the category "${name}"? All transactions linked to it will become Uncategorized.`)) return;
    setError('');
    try {
      await api.delete(`/categories/${id}`);
      setCategories(categories.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
      setError('Failed to delete category.');
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Categories...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Categories & Groups Editor</h1>
      </div>
      
      {error && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)', maxWidth: '800px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        
        {/* GROUPS COLUMN */}
        <div className="card">
          <h2 style={{marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Folder size={20} color="var(--primary)"/> Category Groups
          </h2>
          <p className="text-muted" style={{fontSize: '0.875rem', marginBottom: '1rem'}}>
             Groups are used to organize spending on the dashboard.
          </p>

          <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              placeholder="New group name..." 
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              style={{ flex: 1, padding: '0.6rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'white', outline: 'none' }}
            />
            <button type="submit" className="btn btn-primary" disabled={addingGroup || !newGroupName} style={{ padding: '0.6rem 1rem' }}>
              Add
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {groups.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No groups.</div>
            ) : (
              groups.map(grp => (
                <div key={grp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span>{grp.name}</span>
                  <button onClick={() => handleDeleteGroup(grp.id, grp.name)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Delete Group">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CATEGORIES COLUMN */}
        <div className="card">
          <h2 style={{marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Tags size={20} color="var(--primary)"/> Categories
          </h2>
          
          <form onSubmit={handleCreateCat} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              placeholder="New category..." 
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              style={{ flex: 1, padding: '0.6rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'white', outline: 'none' }}
            />
            <select 
              value={newCatGroupId}
              onChange={e => setNewCatGroupId(e.target.value)}
              style={{ padding: '0.6rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'white', outline: 'none' }}
            >
              <option value="">No Group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button type="submit" className="btn btn-primary" disabled={addingCat || !newCatName} style={{ padding: '0.6rem 1rem' }}>
              Add
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {categories.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No categories created yet.</div>
            ) : (
              categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                  {editingId === cat.id ? (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        value={editName}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleSaveEditCat(cat.id); }}
                        style={{ flex: 1, padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary)', borderRadius: '0.25rem', color: 'white', outline: 'none' }}
                      />
                      <select 
                        value={editGroupId}
                        onChange={e => setEditGroupId(e.target.value)}
                        style={{ padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '0.25rem', color: 'white', outline: 'none', maxWidth: '120px' }}
                      >
                        <option value="">No Group</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <button onClick={() => handleSaveEditCat(cat.id)} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '0.25rem' }} title="Save">
                        <Save size={18} />
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }} title="Cancel">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                        <Tags size={16} color="var(--primary)" />
                        {cat.name}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select 
                          value={cat.group_id || ''}
                          onChange={e => handleQuickGroupChange(cat.id, e.target.value)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '0.25rem', color: 'var(--text-muted)', outline: 'none', maxWidth: '100px' }}
                        >
                          <option value="">Ungrouped</option>
                          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <button onClick={() => handleStartEditCat(cat)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }} title="Rename">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteCat(cat.id, cat.name)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Categories;
