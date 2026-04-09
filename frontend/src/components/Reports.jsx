import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Filter, Download, ChevronDown, ChevronUp,
  RefreshCw, AlertCircle, CheckSquare, Square, XCircle, TrendingDown, Layers
} from 'lucide-react';
import api from '../api';

/* ─── helpers ──────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function MonthLabel(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
}

/* ─── small sub-components ─────────────────────────────────── */
function CategoryRow({ cat, total, isExpanded, onToggle }) {
  const pct = total > 0 ? (cat.value / total) * 100 : 0;
  return (
    <div className="rpt-cat-row">
      <div className="rpt-cat-header" onClick={onToggle}>
        <div className="rpt-cat-left">
          <span className="rpt-chevron">{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          <span className="rpt-cat-name">{cat.name}</span>
          {cat.subcategories?.length > 0 && (
            <span className="rpt-sub-count">{cat.subcategories.length}</span>
          )}
        </div>
        <div className="rpt-cat-right">
          <div className="rpt-bar-wrap">
            <div className="rpt-bar" style={{ width: `${pct}%` }} />
          </div>
          <span className="rpt-pct">{pct.toFixed(1)}%</span>
          <span className="rpt-amount">€{fmt(cat.value)}</span>
        </div>
      </div>

      {isExpanded && cat.subcategories?.length > 0 && (
        <div className="rpt-subcats">
          {cat.subcategories.map((sub) => {
            const sp = cat.value > 0 ? (sub.value / cat.value) * 100 : 0;
            return (
              <div key={sub.name} className="rpt-subcat-row">
                <span className="rpt-subcat-name">↳ {sub.name}</span>
                <div className="rpt-cat-right">
                  <div className="rpt-bar-wrap" style={{ opacity: 0.6 }}>
                    <div className="rpt-bar rpt-bar-sub" style={{ width: `${sp}%` }} />
                  </div>
                  <span className="rpt-pct">{sp.toFixed(1)}%</span>
                  <span className="rpt-amount rpt-amount-sub">€{fmt(sub.value)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── main component ────────────────────────────────────────── */
export default function Reports() {
  const [availableMonths, setAvailableMonths] = useState([]);
  const [allCategories, setAllCategories] = useState([]);   // [{id, name, group_id}]
  const [allGroups, setAllGroups] = useState([]);            // [{id, name}]

  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCatIds, setSelectedCatIds] = useState(new Set()); // empty = all

  const [reportData, setReportData] = useState(null);       // {category_spending, total_expenses}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const [catPanelOpen, setCatPanelOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');

  /* ── fetch available months + categories on mount ── */
  useEffect(() => {
    api.get('/analytics/summary').then((r) => {
      const months = r.data.available_months || [];
      setAvailableMonths(months);
      if (months.length > 0) setSelectedMonth(months[0]);
    }).catch(() => {});

    Promise.all([
      api.get('/categories'),
      api.get('/categories/groups'),
    ]).then(([catRes, grpRes]) => {
      setAllCategories(catRes.data || []);
      setAllGroups(grpRes.data || []);
    }).catch(() => {});
  }, []);

  /* ── generate report ── */
  const generateReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedMonth) params.month = selectedMonth;
      if (selectedCatIds.size > 0) params.category_ids = [...selectedCatIds].join(',');

      const res = await api.get('/analytics/expense-report', { params });
      setReportData(res.data);
      setExpandedGroups(new Set(res.data.category_spending.map((g) => g.name)));
    } catch (e) {
      setError(e.response?.data?.detail || 'Ошибка загрузки отчёта');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedCatIds]);

  /* auto-generate when month changes */
  useEffect(() => {
    if (selectedMonth) generateReport();
  }, [selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── category selection helpers ── */
  const toggleCat = (id) => {
    setSelectedCatIds((prev) => {
      // If we're in "all selected" mode (empty set), expand to all IDs first,
      // then remove the clicked one — visually it looks like we unchecked it.
      if (prev.size === 0) {
        const next = new Set(allCategories.map((c) => c.id));
        next.delete(id);
        return next;
      }
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // If every category is now selected, revert to "all" shortcut (empty set)
      if (next.size === allCategories.length) return new Set();
      return next;
    });
  };

  const toggleGroup = (groupId) => {
    const groupCatIds = allCategories.filter((c) => c.group_id === groupId).map((c) => c.id);
    setSelectedCatIds((prev) => {
      if (prev.size === 0) {
        // "all selected" → deselect this whole group
        const next = new Set(allCategories.map((c) => c.id));
        groupCatIds.forEach((id) => next.delete(id));
        return next;
      }
      const allGroupSelected = groupCatIds.every((id) => prev.has(id));
      const next = new Set(prev);
      groupCatIds.forEach((id) => (allGroupSelected ? next.delete(id) : next.add(id)));
      if (next.size === allCategories.length) return new Set();
      return next;
    });
  };

  const selectAll = () => setSelectedCatIds(new Set());
  const deselectAll = () => setSelectedCatIds(new Set(allCategories.map((c) => c.id)));

  const filteredCats = catSearch
    ? allCategories.filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    : allCategories;

  const catsByGroup = allGroups.map((g) => ({
    ...g,
    cats: filteredCats.filter((c) => c.group_id === g.id),
  })).filter((g) => g.cats.length > 0);

  const ungrouped = filteredCats.filter((c) => !c.group_id);

  // label for category filter button
  const catBtnLabel =
    selectedCatIds.size === 0
      ? 'Все категории'
      : `Выбрано категорий: ${selectedCatIds.size}`;

  /* ── download CSV ── */
  const downloadCsv = () => {
    if (!reportData) return;
    const rows = [['Группа', 'Категория', 'Сумма, EUR']];
    (reportData.category_spending || []).forEach((g) => {
      (g.subcategories || []).forEach((s) => {
        rows.push([g.name, s.name, s.value.toFixed(2)]);
      });
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `report_${selectedMonth || 'all'}.csv`;
    a.click();
  };

  const totalExpenses = reportData?.total_expenses ?? 0;
  const spending = reportData?.category_spending ?? [];

  return (
    <div className="rpt-page">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-title-group">
          <BarChart2 size={28} className="page-icon" />
          <div>
            <h1 className="page-title">Отчёты</h1>
            <p className="page-subtitle">Анализ расходов по категориям и периодам</p>
          </div>
        </div>
        <div className="rpt-header-actions">
          <button className="btn btn-secondary" onClick={downloadCsv} disabled={!reportData}>
            <Download size={16} /> Скачать CSV
          </button>
          <button className="btn btn-primary" onClick={generateReport} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <RefreshCw size={16} />}
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="rpt-filters card">
        <div className="rpt-filter-label"><Filter size={15} /> Фильтры</div>

        {/* Month */}
        <div className="rpt-filter-group">
          <label className="rpt-label">Месяц</label>
          <select
            className="rpt-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">Все время</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{MonthLabel(m)}</option>
            ))}
          </select>
        </div>

        {/* Categories */}
        <div className="rpt-filter-group rpt-cat-filter" style={{ position: 'relative' }}>
          <label className="rpt-label">Категории</label>
          <button
            className="rpt-cat-btn"
            onClick={() => setCatPanelOpen((o) => !o)}
          >
            <Layers size={15} />
            <span>{catBtnLabel}</span>
            <ChevronDown size={14} style={{ marginLeft: 'auto' }} />
          </button>

          {selectedCatIds.size > 0 && (
            <button className="rpt-clear-cats btn-icon btn-ghost" title="Сбросить выбор" onClick={selectAll}>
              <XCircle size={14} />
            </button>
          )}

          {catPanelOpen && (
            <div className="rpt-cat-panel">
              <div className="rpt-cat-panel-top">
                <input
                  className="rpt-search"
                  placeholder="Поиск категорий..."
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  autoFocus
                />
                <div className="rpt-cat-actions">
                  <button className="rpt-text-btn" onClick={selectAll}>Все</button>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <button className="rpt-text-btn" onClick={deselectAll}>Снять все</button>
                </div>
              </div>

              <div className="rpt-cat-list">
                {catsByGroup.map((g) => {
                  const allSel = g.cats.every((c) => selectedCatIds.has(c.id));
                  const someSel = g.cats.some((c) => selectedCatIds.has(c.id));
                  return (
                    <div key={g.id} className="rpt-cat-group">
                      <div className="rpt-cat-group-header" onClick={() => toggleGroup(g.id)}>
                        <span className="rpt-check">
                          {selectedCatIds.size === 0
                            ? <CheckSquare size={14} strokeWidth={2} />
                            : g.cats.every((c) => selectedCatIds.has(c.id))
                              ? <CheckSquare size={14} strokeWidth={2} />
                              : g.cats.some((c) => selectedCatIds.has(c.id))
                                ? <CheckSquare size={14} strokeWidth={2} style={{ opacity: 0.5 }} />
                                : <Square size={14} strokeWidth={2} />}
                        </span>
                        <span>{g.name}</span>
                      </div>
                      {g.cats.map((c) => (
                        <div key={c.id} className="rpt-cat-item" onClick={() => toggleCat(c.id)}>
                          <span className="rpt-check">
                            {selectedCatIds.size === 0 || selectedCatIds.has(c.id) ? <CheckSquare size={13} strokeWidth={2} /> : <Square size={13} strokeWidth={2} />}
                          </span>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {ungrouped.length > 0 && (
                  <div className="rpt-cat-group">
                    <div className="rpt-cat-group-header" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                      <span className="rpt-check" style={{ opacity: 0 }}><Square size={14} /></span>
                      Без группы
                    </div>
                    {ungrouped.map((c) => (
                      <div key={c.id} className="rpt-cat-item" onClick={() => toggleCat(c.id)}>
                        <span className="rpt-check">
                          {selectedCatIds.size === 0 || selectedCatIds.has(c.id) ? <CheckSquare size={13} strokeWidth={2} /> : <Square size={13} strokeWidth={2} />}
                        </span>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rpt-cat-panel-footer">
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { setCatPanelOpen(false); generateReport(); }}>
                  Применить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="error-state">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Summary card ── */}
      {reportData && !loading && (
        <>
          <div className="rpt-summary-strip">
            <div className="rpt-kpi">
              <span className="rpt-kpi-label">Период</span>
              <span className="rpt-kpi-value">{selectedMonth ? MonthLabel(selectedMonth) : 'Всё время'}</span>
            </div>
            <div className="rpt-kpi">
              <span className="rpt-kpi-label">Всего расходов</span>
              <span className="rpt-kpi-value rpt-kpi-red">
                <TrendingDown size={16} style={{ marginRight: 4 }} />
                €{fmt(totalExpenses)}
              </span>
            </div>
            <div className="rpt-kpi">
              <span className="rpt-kpi-label">Категорий</span>
              <span className="rpt-kpi-value">{spending.reduce((s, g) => s + (g.subcategories?.length || 1), 0)}</span>
            </div>
          </div>

          {/* ── Category breakdown ── */}
          <div className="card rpt-breakdown-card">
            <h2 className="rpt-section-title">Расходы по категориям</h2>

            {spending.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-icon"><BarChart2 size={40} /></div>
                <h3>Нет данных</h3>
                <p>За выбранный период расходы не найдены</p>
              </div>
            ) : (
              <div className="rpt-cat-rows">
                {spending
                  .sort((a, b) => b.value - a.value)
                  .map((cat) => (
                    <CategoryRow
                      key={cat.name}
                      cat={cat}
                      total={totalExpenses}
                      isExpanded={expandedGroups.has(cat.name)}
                      onToggle={() =>
                        setExpandedGroups((prev) => {
                          const next = new Set(prev);
                          next.has(cat.name) ? next.delete(cat.name) : next.add(cat.name);
                          return next;
                        })
                      }
                    />
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <span>Формирование отчёта...</span>
        </div>
      )}
    </div>
  );
}
