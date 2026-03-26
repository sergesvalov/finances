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
                      <td>
                        <span style={{ 
                          backgroundColor: 'rgba(255,255,255,0.1)', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '1rem',
                          fontSize: '0.75rem'
                        }}>
                          {t.category || 'Uncategorized'}
                        </span>
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
