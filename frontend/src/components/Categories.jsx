import React, { useState, useEffect } from 'react';
import { Edit2, Save, Trash2, X, Plus, Tags } from 'lucide-react';
import api from '../api';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setAddingCat(true);
    setError('');
    try {
      const res = await api.post('/categories', { name: newCatName.trim() });
      if (!categories.find(c => c.id === res.data.id)) {
        setCategories([...categories, res.data].sort((a,b) => a.name.localeCompare(b.name)));
      }
      setNewCatName('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to create category.');
    } finally {
      setAddingCat(false);
    }
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) return;
    setError('');
    try {
      const res = await api.patch(`/categories/${id}`, { name: editName.trim() });
      setCategories(categories.map(c => c.id === id ? { ...c, name: res.data.name } : c).sort((a,b) => a.name.localeCompare(b.name)));
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to rename category.');
    }
  };

  const handleDelete = async (id, name) => {
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
        <h1 className="page-title">Categories Editor</h1>
      </div>
      
      <div className="card" style={{ maxWidth: '600px' }}>
        
        {error && (
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            placeholder="New category name..." 
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', color: 'white', outline: 'none' }}
          />
          <button type="submit" className="btn btn-primary" disabled={addingCat || !newCatName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} />
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
                      onKeyDown={(e) => { if(e.key === 'Enter') handleSaveEdit(cat.id); }}
                      style={{ flex: 1, padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary)', borderRadius: '0.25rem', color: 'white', outline: 'none' }}
                    />
                    <button onClick={() => handleSaveEdit(cat.id)} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '0.25rem' }} title="Save">
                      <Save size={18} />
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }} title="Cancel">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Tags size={16} color="var(--primary)" />
                      {cat.name}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleStartEdit(cat)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }} title="Rename">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(cat.id, cat.name)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }} title="Delete">
                        <Trash2 size={18} />
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
  );
};

export default Categories;
