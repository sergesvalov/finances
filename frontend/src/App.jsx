import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, FileUp, List, Settings as SettingsIcon, Tags, Inbox } from 'lucide-react';

import Dashboard from './components/Dashboard';
import UploadStatement from './components/UploadStatement';
import TransactionList from './components/TransactionList';
import Settings from './components/Settings';
import Categories from './components/Categories';
import UnreviewedReceipts from './components/UnreviewedReceipts';

function App() {
  return (
    <Router>
      <div className="app-container">
        {/* Sidebar */}
        <nav className="sidebar">
          <div className="brand">
             <LayoutDashboard size={28} />
             <span>FinTracker</span>
          </div>
          
          <NavLink to="/" className={({isActive}) => isActive ? "nav-link active" : "nav-link"} end>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          
          <NavLink to="/transactions" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <List size={20} />
            Transactions
          </NavLink>
          
          <NavLink to="/upload" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <FileUp size={20} />
            Upload
          </NavLink>

          <NavLink to="/categories" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Tags size={20} />
            Categories
          </NavLink>

          <NavLink to="/unreviewed-receipts" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Inbox size={20} />
            Неразобранные чеки
          </NavLink>

          <NavLink to="/settings" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <SettingsIcon size={20} />
            Administration
          </NavLink>
        </nav>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<TransactionList />} />
            <Route path="/upload" element={<UploadStatement />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/unreviewed-receipts" element={<UnreviewedReceipts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
