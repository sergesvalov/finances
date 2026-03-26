import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';

const TransactionList = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [categories, setCategories] = useState([]);
  const [editingTxId, setEditingTxId] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');

  // Fetch categories on mount
  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data)).catch(console.error);
  }, []);

  const handleUpdateCategory = async (txId, categoryId, categoryName) => {
    try {
      let res;
      if (categoryId === null) {
        res = await api.patch(`/transactions/${txId}/category`);
      } else {
        res = await api.patch(`/transactions/${txId}/category?category_id=${categoryId}`);
      }
      
      const { similar_count, description } = res.data;
      
      if (similar_count > 0) {
        await api.post('/transactions/bulk_category', { description, category_id: categoryId });
        fetchTransactions();
        setEditingTxId(null);
        setCategorySearch('');
        return;
      }

      // Update local state if single update
      setTransactions(prev => prev.map(t => t.id === txId ? { ...t, category: categoryName } : t));
    } catch (err) {
      console.error(err);
    } finally {
      setEditingTxId(null);
      setCategorySearch('');
    }
  };

  const handleCreateCategory = async (txId, newName) => {
    try {
      const res = await api.post('/categories', { name: newName });
      const newCat = res.data;
      if (!categories.find(c => c.id === newCat.id)) {
        setCategories(prev => [...prev, newCat]);
      }
      handleUpdateCategory(txId, newCat.id, newCat.name);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/transactions?skip=${skip}&limit=${limit}&search=${search}`);
      setTransactions(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [skip, search]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setSkip(0); // Reset pagination on search
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem 1rem' }}>
           <Search size={18} color="var(--text-muted)" />
           <input 
             type="text" 
             placeholder="Search description..." 
             value={search}
             onChange={handleSearch}
             style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', marginLeft: '0.5rem' }}
           />
        </div>
      </div>
      
      <div className="card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td>{formatDate(t.execution_date)}</td>
                      <td>{t.description}</td>
                      <td style={{ position: 'relative' }}>
                        {editingTxId === t.id ? (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem', width: '220px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
                            <input 
                              type="text" 
                              autoFocus
                              placeholder="Search or create..."
                              value={categorySearch}
                              onChange={(e) => setCategorySearch(e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '0.25rem', marginBottom: '0.5rem', outline: 'none' }}
                            />
                            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                <button key={c.id} onClick={() => handleUpdateCategory(t.id, c.id, c.name)} style={{ textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '0.25rem' }} onMouseOver={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.target.style.backgroundColor = 'transparent'}>
                                  {c.name}
                                </button>
                              ))}
                              {categorySearch && !categories.some(c => c.name.toLowerCase() === categorySearch.toLowerCase()) && (
                                <button onClick={() => handleCreateCategory(t.id, categorySearch)} style={{ textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', borderRadius: '0.25rem', fontWeight: 500 }} onMouseOver={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.target.style.backgroundColor = 'transparent'}>
                                  + Create "{categorySearch}"
                                </button>
                              )}
                              {t.category && (
                                <button onClick={() => handleUpdateCategory(t.id, null, null)} style={{ textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '0.25rem', marginTop: '0.25rem', borderTop: '1px solid var(--border-color)' }} onMouseOver={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.target.style.backgroundColor = 'transparent'}>
                                  Remove Category
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                               <button onClick={() => setEditingTxId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <span 
                            onClick={() => { setEditingTxId(t.id); setCategorySearch(''); }}
                            style={{ 
                              backgroundColor: 'rgba(255,255,255,0.1)', 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}>
                            {t.category || 'Uncategorized'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '500' }} className={t.amount < 0 ? 'amount-negative' : 'amount-positive'}>
                        {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)} {t.currency}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                       <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
               <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Showing {skip + 1} to {Math.min(skip + limit, total)} of {total}
               </span>
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn" 
                    style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' , color: 'white'}}
                    disabled={skip === 0}
                    onClick={() => setSkip(skip - limit)}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <button 
                    className="btn" 
                    style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'white' }}
                    disabled={skip + limit >= total}
                    onClick={() => setSkip(skip + limit)}
                  >
                    Next <ChevronRight size={16} />
                  </button>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
