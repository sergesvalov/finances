import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Wallet, Activity, Calendar } from 'lucide-react';
import api from '../api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');

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

  const currentBalance = data.balance_dynamics.length > 0 
    ? data.balance_dynamics[data.balance_dynamics.length - 1].balance
    : 0;

  const totalSpent = data.category_spending.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Dashboard</h1>
        
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
      </div>

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>Updating data...</div>}

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
           <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '50%' }}>
             <Wallet color="var(--primary)" size={32} />
           </div>
           <div>
             <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Balance (End of Period)</p>
             <h2 style={{ fontSize: '2rem', margin: 0 }}>€{currentBalance.toFixed(2)}</h2>
           </div>
        </div>
        
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
           <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%' }}>
             <Activity color="var(--danger)" size={32} />
           </div>
           <div>
             <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Total Spent (Period)</p>
             <h2 style={{ fontSize: '2rem', margin: 0 }}>€{totalSpent.toFixed(2)}</h2>
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
                    data={data.category_spending}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.category_spending.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value) => `€${value.toFixed(2)}`} 
                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '0.5rem' }} 
                    itemStyle={{ color: 'var(--text-main)' }}
                  />
                  <Legend />
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
          <h3 style={{ marginBottom: '1rem' }}>Category Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[...data.category_spending].sort((a, b) => b.value - a.value).map((cat, index) => {
              const originalIndex = data.category_spending.findIndex(c => c.name === cat.name);
              return (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[originalIndex % COLORS.length] }}></div>
                    <span style={{ fontWeight: '500' }}>{cat.name}</span>
                  </div>
                  <span style={{ fontWeight: '600' }}>€{cat.value.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
