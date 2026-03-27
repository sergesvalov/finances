import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Wallet, Activity, Calendar, X, Send } from 'lucide-react';
import api from '../api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  
  const [selectedPieSegment, setSelectedPieSegment] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  
  const [sendingReport, setSendingReport] = useState(false);

  const [categories, setCategories] = useState([]);
  const [editingTxId, setEditingTxId] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const params = selectedMonth ? { month: selectedMonth } : {};
        const res = await api.get('/analytics/summary', { params });
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [selectedMonth]);

  if (loading && !data) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Dashboard...</div>;
  }

  if (!data || (!data.category_spending.length && !data.balance_dynamics.length && !data.available_months.length)) {
    return (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No data available</h2>
          <p className="text-muted">Upload a Revolut CSV statement to see your analytics.</p>
        </div>
    );
  }

  const handleCategoryClick = async (categoryName) => {
    setSelectedCategory(categoryName);
    setLoadingCategory(true);
    
    // Auto-scroll logic so users see the transactions appearing below
    setTimeout(() => {
      const el = document.getElementById('category-transactions-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);

    try {
      const params = { category: categoryName, limit: 100 };
      if (selectedMonth) params.month = selectedMonth;
      const res = await api.get('/transactions', { params });
      setCategoryTransactions(res.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCategory(false);
    }
  };

  const handleUpdateTransactionCategory = async (txId, categoryId, categoryName) => {
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
         if (selectedCategory) {
            const params = { category: selectedCategory, limit: 100 };
            if (selectedMonth) params.month = selectedMonth;
            api.get('/transactions', { params }).then(tr => setCategoryTransactions(tr.data.items));
         }
      } else {
         setCategoryTransactions(prev => prev.map(t => t.id === txId ? { ...t, category: categoryName } : t));
      }
      
      // Re-fetch analytics to perfectly reflect the change in charts & totals
      const params = selectedMonth ? { month: selectedMonth } : {};
      api.get('/analytics/summary', { params })
         .then(res => setData(res.data))
         .catch(console.error);

    } catch (err) {
      console.error(err);
    } finally {
      setEditingTxId(null);
      setCategorySearch('');
    }
  };

  const handleCreateNewCategory = async (txId, newName) => {
    try {
      const res = await api.post('/categories', { name: newName });
      const newCat = res.data;
      if (!categories.find(c => c.id === newCat.id)) {
        setCategories(prev => [...prev, newCat]);
      }
      handleUpdateTransactionCategory(txId, newCat.id, newCat.name);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendTelegramReport = async () => {
    setSendingReport(true);
    try {
      const res = await api.post('/analytics/report/telegram', { month: selectedMonth });
      alert(res.data.message);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to send report");
    } finally {
      setSendingReport(false);
    }
  };

  const currentBalance = data.balance_dynamics.length > 0 
    ? data.balance_dynamics[data.balance_dynamics.length - 1].balance
    : 0;

  const totalSpent = data.category_spending.reduce((acc, curr) => acc + curr.value, 0);

  const flatCategories = data.category_spending.reduce((acc, group) => {
    if (group.subcategories && group.subcategories.length > 0) {
      return [...acc, ...group.subcategories];
    }
    return [...acc, { name: group.name, value: group.value }];
  }, []).sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Dashboard</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {data.available_months && data.available_months.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} color="var(--text-muted)" />
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Time</option>
                {data.available_months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
          <button 
             onClick={handleSendTelegramReport} 
             disabled={sendingReport}
             className="btn btn-primary" 
             style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            <Send size={16} />
            {sendingReport ? 'Sending...' : 'Send Telegram Report'}
          </button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>Updating data...</div>}

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
           <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '50%' }}>
             <Wallet color="var(--primary)" size={32} />
           </div>
           <div>
             <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Balance</p>
             <h2 style={{ fontSize: '1.75rem', margin: 0 }}>€{currentBalance.toFixed(2)}</h2>
           </div>
        </div>
        
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
           <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '50%' }}>
             <ArrowUpRight color="var(--success)" size={32} />
           </div>
           <div>
             <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Total Income</p>
             <h2 style={{ fontSize: '1.75rem', margin: 0 }}>€{(data.total_income || 0).toFixed(2)}</h2>
           </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
           <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%' }}>
             <ArrowDownRight color="var(--danger)" size={32} />
           </div>
           <div>
             <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Total Expenses</p>
             <h2 style={{ fontSize: '1.75rem', margin: 0 }}>€{totalSpent.toFixed(2)}</h2>
           </div>
        </div>
      </div>

      {data.category_spending.length === 0 && data.balance_dynamics.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--card-bg)', borderRadius: '1rem', marginTop: '1.5rem' }}>
          <p className="text-muted">No transactions found for the selected period.</p>
        </div>
      ) : (
        <>
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card chart-card">
            <h3 style={{ marginBottom: '1.5rem' }}>Spending by Category</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={flatCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(entry) => setSelectedPieSegment(entry)}
                    style={{ cursor: 'pointer' }}
                  >
                    {flatCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value) => `€${value.toFixed(2)}`} 
                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }} 
                    itemStyle={{ color: 'var(--text-main)' }}
                  />
                  <Legend 
                    onClick={(props) => {
                      if (props && props.payload && props.payload.name) {
                        setSelectedPieSegment(props.payload);
                      } else if (props && props.name) {
                        setSelectedPieSegment(props);
                      }
                    }}
                    wrapperStyle={{ cursor: 'pointer' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <h3 style={{ marginBottom: '1.5rem' }}>Balance Dynamics</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.balance_dynamics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(value) => `€${value}`} />
                  <RechartsTooltip 
                    formatter={(value) => `€${value.toFixed(2)}`} 
                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }} 
                    itemStyle={{ color: 'var(--text-main)' }}
                  />
                  <Line type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Category Breakdown</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {[...data.category_spending].sort((a, b) => b.value - a.value).map((group, index) => {
              const originalIndex = data.category_spending.findIndex(c => c.name === group.name);
              const color = COLORS[originalIndex % COLORS.length];
              
              return (
                <div key={group.name} className="card" style={{ padding: '1rem', borderTop: `4px solid ${color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{group.name}</h4>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>€{group.value.toFixed(2)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {group.subcategories && group.subcategories.map(sub => (
                       <div 
                         key={sub.name} 
                         onClick={() => handleCategoryClick(sub.name)}
                         style={{ 
                           display: 'flex', 
                           justifyContent: 'space-between', 
                           fontSize: '0.9rem', 
                           color: selectedCategory === sub.name ? 'var(--primary)' : 'var(--text-muted)',
                           cursor: 'pointer',
                           padding: '0.5rem',
                           borderRadius: '0.25rem',
                           backgroundColor: selectedCategory === sub.name ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                           transition: 'all 0.2s ease'
                         }}
                         onMouseOver={(e) => {
                           if (selectedCategory !== sub.name) {
                             e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                             e.currentTarget.style.color = 'var(--text-main)';
                           }
                         }}
                         onMouseOut={(e) => {
                           if (selectedCategory !== sub.name) {
                             e.currentTarget.style.backgroundColor = 'transparent';
                             e.currentTarget.style.color = 'var(--text-muted)';
                           }
                         }}
                       >
                          <span>{sub.name}</span>
                          <span style={{ color: selectedCategory === sub.name ? 'var(--primary)' : 'var(--text-main)' }}>€{sub.value.toFixed(2)}</span>
                       </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}

      {/* Pie Chart Click Modal */}
      {selectedPieSegment && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }}
        onClick={(e) => {
          // close if clicking exactly on backdrop
          if (e.target === e.currentTarget) setSelectedPieSegment(null);
        }}>
          <div className="card" style={{ width: '320px', backgroundColor: 'var(--card-bg)', position: 'relative', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <button 
              onClick={() => setSelectedPieSegment(null)} 
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '0.25rem', paddingRight: '2rem', fontSize: '1.25rem' }}>
               {selectedPieSegment.name}
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Category Detail
            </p>
            
            <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                 <span style={{ color: 'var(--text-muted)' }}>Amount Spent:</span>
                 <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>€{selectedPieSegment.value.toFixed(2)}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                 <span style={{ color: 'var(--text-muted)' }}>% of Total:</span>
                 <span style={{ fontWeight: '600', color: 'var(--primary)' }}>
                   {((selectedPieSegment.value / totalSpent) * 100).toFixed(1)}%
                 </span>
               </div>
            </div>

            <button 
               onClick={() => { 
                 const catName = selectedPieSegment.name;
                 setSelectedPieSegment(null); 
                 handleCategoryClick(catName); 
               }} 
               className="btn btn-primary" 
               style={{ width: '100%', padding: '0.75rem', fontWeight: '500' }}>
               View Transactions
            </button>
          </div>
        </div>
      )}

      {/* Inline Category Transactions */}
      {selectedCategory && (
        <div id="category-transactions-card" className="card" style={{ marginTop: '1.5rem', scrollMarginTop: '2rem' }}>
          <div style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>{selectedCategory} Transactions</h3>
            <button onClick={() => setSelectedCategory(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loadingCategory ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Loading transactions...</div>
            ) : categoryTransactions.length === 0 ? (
               <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No transactions found.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem', fontWeight: 500 }}>Date</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem', fontWeight: 500 }}>Description</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem', fontWeight: 500 }}>Category</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.5rem', fontWeight: 500 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTransactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{t.execution_date.split('T')[0]}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{t.description}</td>
                      <td style={{ padding: '0.75rem 0.5rem', position: 'relative' }}>
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
                                <button key={c.id} onClick={() => handleUpdateTransactionCategory(t.id, c.id, c.name)} style={{ textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '0.25rem' }} onMouseOver={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.target.style.backgroundColor = 'transparent'}>
                                  {c.name}
                                </button>
                              ))}
                              {categorySearch && !categories.some(c => c.name.toLowerCase() === categorySearch.toLowerCase()) && (
                                <button onClick={() => handleCreateNewCategory(t.id, categorySearch)} style={{ textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', borderRadius: '0.25rem', fontWeight: 500 }} onMouseOver={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.target.style.backgroundColor = 'transparent'}>
                                  + Create "{categorySearch}"
                                </button>
                              )}
                              {t.category && (
                                <button onClick={() => handleUpdateTransactionCategory(t.id, null, null)} style={{ textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '0.25rem', marginTop: '0.25rem', borderTop: '1px solid var(--border-color)' }} onMouseOver={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.target.style.backgroundColor = 'transparent'}>
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
                      <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 500, color: t.amount < 0 ? 'var(--text-main)' : 'var(--success)' }}>
                        €{Math.abs(t.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
