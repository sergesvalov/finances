import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Sankey, AreaChart, Area } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Wallet, Calendar, X, Send, Paperclip, Trash2, Upload, FileText, SplitSquareHorizontal, Plus, Save } from 'lucide-react';
import api from '../api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [payees, setPayees] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [excludeTransfers, setExcludeTransfers] = useState(false);
  
  const [selectedPieSegment, setSelectedPieSegment] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateTransactions, setDateTransactions] = useState([]);
  const [loadingDate, setLoadingDate] = useState(false);
  
  const [sendingReport, setSendingReport] = useState(false);

  const [categories, setCategories] = useState([]);
  const [editingTxId, setEditingTxId] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');

  // Transaction detail modal state
  const [receiptModalTx, setReceiptModalTx] = useState(null);
  const [modalTab, setModalTab] = useState('receipt'); // 'receipt' | 'splits'
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [deletingReceipt, setDeletingReceipt] = useState(false);

  // Splits state
  const [splitRows, setSplitRows] = useState([]); // [{category_id, category, amount, note}]
  const [savingSplits, setSavingSplits] = useState(false);

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const params = selectedMonth ? { month: selectedMonth } : {};
        if (excludeTransfers) {
            params.exclude_transfers = true;
        }
        const [resSum, resPayees, resSubs] = await Promise.all([
           api.get('/analytics/summary', { params }).catch(e => ({ data: null })),
           api.get('/analytics/payees', { params }).catch(e => ({ data: [] })),
           api.get('/analytics/subscriptions', { params: excludeTransfers ? { exclude_transfers: true } : {} }).catch(e => ({ data: [] }))
        ]);
        setData(resSum.data);
        setPayees(resPayees.data || []);
        setSubscriptions(resSubs.data || []);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [selectedMonth, excludeTransfers]);

  if (loading && !data) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Dashboard...</div>;
  }

  if (!data || !data.category_spending || (!data.category_spending.length && (!data.balance_dynamics || !data.balance_dynamics.length) && (!data.available_months || !data.available_months.length))) {
    return (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No data available</h2>
          <p className="text-muted">Analytics data could not be loaded or is empty.</p>
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
      if (excludeTransfers) params.exclude_transfers = true;
      const res = await api.get('/transactions', { params });
      setCategoryTransactions(res.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCategory(false);
    }
  };

  const handleDayClick = async (day) => {
    const [year, m] = selectedMonth.split('-');
    const dateStr = `${year}-${m}-${day.toString().padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setLoadingDate(true);
    
    // Auto-scroll logic so users see the transactions appearing below
    setTimeout(() => {
      const el = document.getElementById('date-transactions-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);

    try {
      const params = { date: dateStr, limit: 100 };
      if (excludeTransfers) params.exclude_transfers = true;
      const res = await api.get('/transactions', { params });
      setDateTransactions(res.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDate(false);
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
      if (excludeTransfers) params.exclude_transfers = true;
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

  const BACKEND_BASE = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
    : '';

  const getReceiptUrl = (receipt_path) =>
    receipt_path ? `${BACKEND_BASE}/receipts/${receipt_path}` : null;

  const handleOpenReceiptModal = (tx) => {
    setReceiptModalTx({ ...tx });
    setModalTab('receipt');
    // Load existing splits from transaction data
    setSplitRows((tx.splits || []).map(s => ({ ...s, amount: Math.abs(s.amount) })));
  };

  const addSplitRow = () => {
    setSplitRows(prev => [...prev, { category_id: null, category: null, amount: '', note: '' }]);
  };

  const updateSplitRow = (idx, field, value) => {
    setSplitRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeSplitRow = (idx) => {
    setSplitRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveSplits = async () => {
    if (!receiptModalTx) return;
    setSavingSplits(true);
    try {
      const payload = {
        splits: splitRows
          .filter(r => r.amount !== '' && parseFloat(r.amount) > 0)
          .map(r => ({
            category_id: r.category_id || null,
            amount: parseFloat(r.amount),
            note: r.note || null,
          }))
      };
      await api.put(`/transactions/${receiptModalTx.id}/splits`, payload);
      // Update local transaction with new splits
      const updatedSplits = payload.splits.map((s, i) => ({
        ...s,
        id: splitRows.filter(r => r.amount !== '' && parseFloat(r.amount) > 0)[i]?.id,
        category: splitRows.filter(r => r.amount !== '' && parseFloat(r.amount) > 0)[i]?.category,
      }));
      const updatedTx = { ...receiptModalTx, splits: updatedSplits };
      setReceiptModalTx(updatedTx);
      setCategoryTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
      setDateTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка сохранения разбивки');
    } finally {
      setSavingSplits(false);
    }
  };

  const handleDeleteSplits = async () => {
    if (!receiptModalTx) return;
    try {
      await api.delete(`/transactions/${receiptModalTx.id}/splits`);
      setSplitRows([]);
      const updatedTx = { ...receiptModalTx, splits: [] };
      setReceiptModalTx(updatedTx);
      setCategoryTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
      setDateTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка удаления разбивки');
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !receiptModalTx) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 15 МБ.');
      return;
    }
    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await import('axios').then(m => m.default.post(
        `${BACKEND_BASE}/api/transactions/${receiptModalTx.id}/receipt`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      ));
      const updatedTx = { ...receiptModalTx, receipt_path: res.data.receipt_path };
      setReceiptModalTx(updatedTx);
      setCategoryTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
      setDateTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка загрузки файла');
    } finally {
      setUploadingReceipt(false);
      e.target.value = '';
    }
  };

  const handleReceiptDelete = async () => {
    if (!receiptModalTx?.receipt_path) return;
    setDeletingReceipt(true);
    try {
      await import('axios').then(m => m.default.delete(
        `${BACKEND_BASE}/api/transactions/${receiptModalTx.id}/receipt`
      ));
      const updatedTx = { ...receiptModalTx, receipt_path: null };
      setReceiptModalTx(updatedTx);
      setCategoryTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
      setDateTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка удаления файла');
    } finally {
      setDeletingReceipt(false);
    }
  };

  const handleSendTelegramReport = async () => {
    setSendingReport(true);
    try {
      const res = await api.post('/analytics/report/telegram', { month: selectedMonth, exclude_transfers: excludeTransfers });
      alert(res.data.message);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to send report");
    } finally {
      setSendingReport(false);
    }
  };

  const currentBalance = data.balance_dynamics && data.balance_dynamics.length > 0 
    ? data.balance_dynamics[data.balance_dynamics.length - 1].balance
    : 0;

  const totalSpent = data.category_spending ? data.category_spending.reduce((acc, curr) => acc + curr.value, 0) : 0;

  const calculateChange = (current, previous) => {
    if (!previous) return null;
    const diff = current - previous;
    const percent = (diff / previous) * 100;
    return {
      value: percent,
      isPositive: percent > 0,
      isNegative: percent < 0,
      text: `${Math.abs(percent).toFixed(1)}%`
    };
  };

  const incomeChange = calculateChange(data.total_income || 0, data.previous_total_income);
  const expenseChange = calculateChange(totalSpent, data.previous_total_expenses);

  const flatCategories = data.category_spending ? data.category_spending.reduce((acc, group) => {
    if (group.subcategories && group.subcategories.length > 0) {
      return [...acc, ...group.subcategories];
    }
    return [...acc, { name: group.name, value: group.value }];
  }, []).sort((a, b) => b.value - a.value) : [];

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--card-bg)', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
             <input 
               type="checkbox" 
               id="exclude-transfers" 
               checked={excludeTransfers} 
               onChange={(e) => setExcludeTransfers(e.target.checked)} 
               style={{ cursor: 'pointer' }}
             />
             <label htmlFor="exclude-transfers" style={{ fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-main)' }}>
               Только покупки (без переводов)
             </label>
          </div>
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
        
        {!excludeTransfers && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
             <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '50%' }}>
               <ArrowUpRight color="var(--success)" size={32} />
             </div>
             <div>
               <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500', margin: '0 0 0.25rem 0' }}>Total Income</p>
               <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                 <h2 style={{ fontSize: '1.75rem', margin: 0 }}>€{(data.total_income || 0).toFixed(2)}</h2>
                 {incomeChange && (
                   <span style={{ fontSize: '0.875rem', fontWeight: '500', color: incomeChange.isPositive ? 'var(--success)' : 'var(--danger)' }} title="vs previous month">
                     {incomeChange.isPositive ? '↑' : '↓'} {incomeChange.text}
                   </span>
                 )}
               </div>
             </div>
          </div>
        )}

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
           <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%' }}>
             <ArrowDownRight color="var(--danger)" size={32} />
           </div>
           <div>
             <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500', margin: '0 0 0.25rem 0' }}>Total Expenses</p>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
               <h2 style={{ fontSize: '1.75rem', margin: 0 }}>€{totalSpent.toFixed(2)}</h2>
               {expenseChange && (
                 <span style={{ fontSize: '0.875rem', fontWeight: '500', color: expenseChange.isPositive ? 'var(--danger)' : 'var(--success)' }} title="vs previous month">
                   {expenseChange.isPositive ? '↑' : '↓'} {expenseChange.text}
                 </span>
               )}
             </div>
           </div>
        </div>
      </div>

      {(!data.category_spending || data.category_spending.length === 0) && (!data.balance_dynamics || data.balance_dynamics.length === 0) ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--card-bg)', borderRadius: '1rem', marginTop: '1.5rem' }}>
          <p className="text-muted">No transactions found for the selected period.</p>
        </div>
      ) : (
        <>
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card chart-card" style={{ height: '520px' }}>
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

          <div className="card chart-card" style={{ height: '520px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Income & Expenses Dynamics</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {data.income_expenses_dynamics && data.income_expenses_dynamics.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.income_expenses_dynamics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(value) => `€${value}`} />
                    <RechartsTooltip 
                      formatter={(value) => `€${value.toFixed(2)}`} 
                      contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }} 
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    {!excludeTransfers && (
                      <Line type="monotone" name="Income" dataKey="income" stroke="var(--success)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    )}
                    <Line type="monotone" name="Expenses" dataKey="expense" stroke="var(--danger)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Not enough data</div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Sankey & Cumulative */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '1.5rem' }}>
          <div className="card chart-card" style={{ height: '400px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Cash Flow (Sankey)</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {data.sankey_data && data.sankey_data.nodes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={data.sankey_data}
                    node={{ stroke: 'var(--border-color)', strokeWidth: 1 }}
                    nodePadding={50}
                    margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                    link={{ stroke: 'var(--primary)', strokeOpacity: 0.2 }}
                  >
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }} itemStyle={{ color: 'var(--text-main)' }} />
                  </Sankey>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Not enough data</div>
              )}
            </div>
          </div>
          
          <div className="card chart-card" style={{ height: '400px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Cumulative Spending vs Prev Month</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {data.cumulative_spending && data.cumulative_spending.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.cumulative_spending} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(value) => `€${value}`} />
                    <RechartsTooltip 
                      formatter={(value) => `€${value.toFixed(2)}`} 
                      contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }} 
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                    <Line type="monotone" name="Current Month" dataKey="current" stroke="var(--danger)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" name="Previous Month" dataKey="previous" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Not enough data</div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2.5: Cumulative by Category */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', marginTop: '1.5rem' }}>
          <div className="card chart-card" style={{ height: '400px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Cumulative Spending by Category</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {data.cumulative_category_spending && data.cumulative_category_spending.length > 0 && data.cumulative_spending_categories ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.cumulative_category_spending} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(value) => `€${value}`} />
                    <RechartsTooltip 
                      formatter={(value) => `€${value.toFixed(2)}`} 
                      contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }} 
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                    <Legend />
                    {data.cumulative_spending_categories.map((cat, index) => (
                       <Area 
                         key={cat}
                         type="monotone" 
                         dataKey={cat} 
                         stackId="1" 
                         stroke={COLORS[index % COLORS.length]} 
                         fill={COLORS[index % COLORS.length]} 
                         activeDot={false}
                       />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Not enough data</div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Expense Heatmap */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
           <h3 style={{ marginBottom: '1.5rem' }}>Daily Expense Heatmap</h3>
           {!selectedMonth ? (
             <div style={{ color: 'var(--text-muted)' }}>Please select a specific month to view the daily heatmap.</div>
           ) : data.daily_expenses && data.daily_expenses.length > 0 ? (
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
               {(() => {
                  const [year, m] = selectedMonth.split('-');
                  const daysInMonth = new Date(year, parseInt(m, 10), 0).getDate();
                  const expenseMap = data.daily_expenses.reduce((acc, curr) => {
                     acc[parseInt(curr.date.split('-')[2], 10)] = curr.value;
                     return acc;
                  }, {});
                  const maxExpense = Math.max(...data.daily_expenses.map(d => d.value), 1);
                  return Array.from({length: daysInMonth}, (_, i) => i + 1).map(day => {
                     const val = expenseMap[day] || 0;
                     const intensity = val > 0 ? Math.max(0.2, val / maxExpense) : 0;
                     return (
                       <div key={day} 
                         title={`Day ${day}: €${val.toFixed(2)}`}
                         style={{
                           width: '40px', height: '40px', 
                           backgroundColor: intensity > 0 ? `rgba(239, 68, 68, ${intensity})` : 'rgba(255,255,255,0.05)',
                           borderRadius: '4px',
                           display: 'flex', justifyContent: 'center', alignItems: 'center',
                           fontSize: '0.75rem',
                           color: intensity > 0.5 ? '#fff' : 'var(--text-muted)',
                           border: intensity > 0 ? '1px solid rgba(239,68,68,0.5)' : '1px solid transparent',
                           transition: 'transform 0.1s ease',
                           cursor: 'pointer'
                         }}
                         onClick={() => handleDayClick(day)}
                         onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                         onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                       >
                         {day}
                       </div>
                     );
                  });
               })()}
             </div>
           ) : (
             <div style={{ color: 'var(--text-muted)' }}>No daily expense data available.</div>
           )}
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Category Breakdown</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {data.category_spending && [...data.category_spending].sort((a, b) => b.value - a.value).map((group, index) => {
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

        {/* Row 4: Top Payees & Subscriptions */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '1.5rem' }}>
          
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>Top Payees</h3>
            {payees && payees.length > 0 ? (
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                 <tbody>
                    {payees.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                         <td style={{ padding: '0.75rem 0', color: 'var(--text-main)', fontWeight: 500 }}>{p.name}</td>
                         <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--danger)' }}>€{p.value.toFixed(2)}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            ) : (
               <div style={{ color: 'var(--text-muted)' }}>No payee data found.</div>
            )}
          </div>
          
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>Active Subscriptions & Recurring</h3>
            {subscriptions && subscriptions.length > 0 ? (
               <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                   <tbody>
                      {subscriptions.map((sub, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                           <td style={{ padding: '0.75rem 0' }}>
                             <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{sub.name}</div>
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Active {sub.months_active} months • Last seen {sub.last_date}</div>
                           </td>
                           <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                             <div style={{ color: 'var(--danger)', fontWeight: 500 }}>€{sub.latest_amount.toFixed(2)}</div>
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Avg: €{sub.average_amount.toFixed(2)}</div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
               </div>
            ) : (
               <div style={{ color: 'var(--text-muted)' }}>No subscriptions or recurring payments identified.</div>
            )}
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
                    <th style={{ textAlign: 'center', paddingBottom: '0.5rem', fontWeight: 500, width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTransactions.map(t => (
                    <tr key={t.id}
                      onClick={() => handleOpenReceiptModal(t)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{t.execution_date.split('T')[0]}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{t.description}</td>
                      <td style={{ padding: '0.75rem 0.5rem', position: 'relative' }}>
                        {editingTxId === t.id ? (
                          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem', width: '220px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
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
                            onClick={(e) => { e.stopPropagation(); setEditingTxId(t.id); setCategorySearch(''); }}
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
                      <td style={{ padding: '0.75rem 0', textAlign: 'center', width: '32px' }}
                        onClick={e => { e.stopPropagation(); handleOpenReceiptModal(t); }}
                      >
                        {t.receipt_path
                          ? <Paperclip size={14} color="var(--primary)" title="Чек прикреплён" />
                          : <Paperclip size={14} color="rgba(255,255,255,0.2)" title="Прикрепить чек" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Inline Date Transactions */}
      {selectedDate && (
        <div id="date-transactions-card" className="card" style={{ marginTop: '1.5rem', scrollMarginTop: '2rem' }}>
          <div style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Transactions on {selectedDate}</h3>
            <button onClick={() => setSelectedDate(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loadingDate ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Loading transactions...</div>
            ) : dateTransactions.length === 0 ? (
               <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No transactions found.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem', fontWeight: 500 }}>Time</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem', fontWeight: 500 }}>Description</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.5rem', fontWeight: 500 }}>Category</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.5rem', fontWeight: 500 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dateTransactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{t.execution_date.split('T')[1]?.substring(0,5) || t.execution_date.split('T')[0]}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{t.description}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span 
                            style={{ 
                              backgroundColor: 'rgba(255,255,255,0.1)', 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              display: 'inline-block'
                            }}>
                            {t.category || 'Uncategorized'}
                          </span>
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

      {/* Receipt Modal */}
      {receiptModalTx && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setReceiptModalTx(null); }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)', padding: '1rem'
          }}
        >
          <div className="card" style={{
            width: '100%', maxWidth: '680px', backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-color)', borderRadius: '1rem',
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.6)', position: 'relative',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.25rem 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ flex: 1, paddingRight: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', lineHeight: 1.3 }}>{receiptModalTx.description}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>{receiptModalTx.execution_date.split('T')[0]}</span>
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.5rem', borderRadius: '1rem' }}>
                      {receiptModalTx.category || 'Без категории'}
                    </span>
                    <span style={{ color: receiptModalTx.amount < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                      €{Math.abs(receiptModalTx.amount).toFixed(2)}
                    </span>
                    {receiptModalTx.splits && receiptModalTx.splits.length > 0 && (
                      <span style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: 'var(--primary)', padding: '0.1rem 0.5rem', borderRadius: '1rem' }}>
                        {receiptModalTx.splits.length} частей
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setReceiptModalTx(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}>
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color)' }}>
                {[
                  { key: 'receipt', label: 'Чек', icon: <Paperclip size={14} /> },
                  { key: 'splits', label: 'Разбивка', icon: <SplitSquareHorizontal size={14} /> },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setModalTab(tab.key)} style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.6rem 1rem', background: 'none', border: 'none',
                    borderBottom: modalTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                    color: modalTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: modalTab === tab.key ? 600 : 400,
                    fontSize: '0.85rem', marginBottom: '-1px', transition: 'all 0.15s'
                  }}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>

              {/* ── Receipt tab ── */}
              {modalTab === 'receipt' && (
                <>
                  {receiptModalTx.receipt_path ? (
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                      {/\.(jpe?g|png|gif|webp|bmp)$/i.test(receiptModalTx.receipt_path) ? (
                        <a href={getReceiptUrl(receiptModalTx.receipt_path)} target="_blank" rel="noreferrer">
                          <img src={getReceiptUrl(receiptModalTx.receipt_path)} alt="Чек"
                            style={{ width: '100%', maxHeight: '400px', objectFit: 'contain',
                              borderRadius: '0.5rem', border: '1px solid var(--border-color)',
                              backgroundColor: 'rgba(0,0,0,0.2)', cursor: 'zoom-in' }}
                          />
                        </a>
                      ) : (
                        <a href={getReceiptUrl(receiptModalTx.receipt_path)} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem',
                            borderRadius: '0.5rem', border: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--text-main)', textDecoration: 'none' }}>
                          <FileText size={32} color="#ef4444" />
                          <span style={{ fontSize: '0.875rem' }}>Открыть PDF чек</span>
                        </a>
                      )}
                      <button onClick={handleReceiptDelete} disabled={deletingReceipt} title="Удалить чек"
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)',
                          border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: deletingReceipt ? 'wait' : 'pointer', color: '#ef4444' }}>
                        {deletingReceipt ? '…' : <Trash2 size={15} />}
                      </button>
                    </div>
                  ) : (
                    <div style={{ border: '2px dashed var(--border-color)', borderRadius: '0.75rem',
                      padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      <Paperclip size={28} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem' }}>Чек не прикреплён</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>Загрузите фото или PDF чека</p>
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.75rem', borderRadius: '0.5rem',
                    background: uploadingReceipt ? 'rgba(99,102,241,0.3)' : 'var(--primary)',
                    color: 'white', cursor: uploadingReceipt ? 'wait' : 'pointer',
                    fontWeight: 500, fontSize: '0.875rem' }}>
                    <Upload size={16} />
                    {uploadingReceipt ? 'Загрузка...' : receiptModalTx.receipt_path ? 'Заменить чек' : 'Прикрепить чек'}
                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                      onChange={handleReceiptUpload} disabled={uploadingReceipt} />
                  </label>
                </>
              )}

              {/* ── Splits tab ── */}
              {modalTab === 'splits' && (() => {
                const txAbs = Math.abs(receiptModalTx.amount);
                const splitTotal = splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                const remainder = +(txAbs - splitTotal).toFixed(2);
                const isValid = Math.abs(remainder) < 0.015;
                return (
                  <>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Распределите сумму €{txAbs.toFixed(2)} по нескольким категориям.
                      Разбивка не изменяет основную категорию транзакции.
                    </p>

                    {/* Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {splitRows.map((row, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: '0.4rem', alignItems: 'center' }}>
                          <select
                            value={row.category_id || ''}
                            onChange={e => {
                              const cid = e.target.value ? parseInt(e.target.value) : null;
                              const cname = cid ? (categories.find(c => c.id === cid)?.name || null) : null;
                              updateSplitRow(idx, 'category_id', cid);
                              updateSplitRow(idx, 'category', cname);
                            }}
                            style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)',
                              border: '1px solid var(--border-color)', padding: '0.4rem 0.5rem',
                              borderRadius: '0.4rem', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                          >
                            <option value="">— категория —</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <input
                            type="number" min="0" step="0.01"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={e => updateSplitRow(idx, 'amount', e.target.value)}
                            style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)',
                              border: '1px solid var(--border-color)', padding: '0.4rem 0.5rem',
                              borderRadius: '0.4rem', fontSize: '0.85rem', outline: 'none',
                              textAlign: 'right', width: '100%' }}
                          />
                          <button onClick={() => removeSplitRow(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)',
                              cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add row */}
                    <button onClick={addSplitRow}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem',
                        background: 'none', border: '1px dashed var(--border-color)',
                        color: 'var(--text-muted)', borderRadius: '0.4rem', padding: '0.4rem 0.75rem',
                        cursor: 'pointer', fontSize: '0.8rem', marginBottom: '1rem', width: '100%',
                        justifyContent: 'center' }}>
                      <Plus size={14} /> Добавить строку
                    </button>

                    {/* Totals */}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem',
                      padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Сумма транзакции:</span>
                        <span style={{ fontWeight: 600 }}>€{txAbs.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Распределено:</span>
                        <span style={{ fontWeight: 600 }}>€{splitTotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                        borderTop: '1px solid var(--border-color)', paddingTop: '0.3rem' }}>
                        <span style={{ color: remainder < -0.01 ? '#ef4444' : 'var(--text-muted)' }}>Остаток:</span>
                        <span style={{ fontWeight: 700,
                          color: isValid ? 'var(--success)' : (remainder < 0 ? '#ef4444' : 'var(--text-main)') }}>
                          €{remainder.toFixed(2)}
                          {isValid && ' ✓'}
                        </span>
                      </div>
                    </div>

                    {remainder < -0.01 && (
                      <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0 0 0.75rem 0' }}>
                        ⚠ Сумма разбивки превышает сумму транзакции
                      </p>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={handleSaveSplits} disabled={savingSplits || remainder < -0.01}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                          padding: '0.7rem', borderRadius: '0.5rem',
                          background: (savingSplits || remainder < -0.01) ? 'rgba(99,102,241,0.3)' : 'var(--primary)',
                          color: 'white', border: 'none', cursor: (savingSplits || remainder < -0.01) ? 'not-allowed' : 'pointer',
                          fontWeight: 600, fontSize: '0.875rem' }}>
                        <Save size={15} />
                        {savingSplits ? 'Сохранение...' : 'Сохранить разбивку'}
                      </button>
                      {splitRows.length > 0 && (
                        <button onClick={handleDeleteSplits}
                          style={{ padding: '0.7rem 1rem', borderRadius: '0.5rem',
                            background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontSize: '0.875rem' }}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
