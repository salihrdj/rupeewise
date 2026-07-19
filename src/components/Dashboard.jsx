import React, { useState, useMemo } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Coins
} from 'lucide-react'
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  Legend
} from 'recharts'

export default function Dashboard({ transactions = [], categories = [], debts = [] }) {
  // Toggle for donut chart breakdown
  const [donutType, setDonutType] = useState('outflow')

  // Get current date references
  const now = useMemo(() => new Date(), [])

  // Generate list of available months and years dynamically from transaction history
  const availablePeriods = useMemo(() => {
    const periods = new Map() // Key: YYYY-MM or YYYY, Value: period object
    
    // Sort transactions newest first
    const sortedTxs = [...transactions].sort((a, b) => b.date.localeCompare(a.date))
    
    sortedTxs.forEach(t => {
      if (!t.date) return
      const d = new Date(t.date)
      if (isNaN(d.getTime())) return
      
      const year = d.getFullYear()
      const month = d.getMonth()
      
      // 1. Monthly period
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
      if (!periods.has(monthKey)) {
        const monthLabel = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        periods.set(monthKey, {
          key: monthKey,
          label: monthLabel,
          year,
          month,
          type: 'month'
        })
      }
      
      // 2. Yearly period
      const yearKey = `${year}`
      if (!periods.has(yearKey)) {
        periods.set(yearKey, {
          key: yearKey,
          label: `${year} (Full Year)`,
          year,
          month: null,
          type: 'year'
        })
      }
    })
    
    const list = Array.from(periods.values())
    
    // Ensure current month is always present even if there are no transactions yet
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (!periods.has(currentMonthKey)) {
      const label = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      list.unshift({
        key: currentMonthKey,
        label,
        year: now.getFullYear(),
        month: now.getMonth(),
        type: 'month'
      })
    }
    
    // Sort keys alphabetically descending (newest first)
    list.sort((a, b) => b.key.localeCompare(a.key))
    return list
  }, [transactions, now])

  // Default to the current calendar month key
  const defaultPeriodKey = useMemo(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [now])

  const [selectedPeriodKey, setSelectedPeriodKey] = useState(defaultPeriodKey)

  // Find active period details
  const selectedPeriod = useMemo(() => {
    return availablePeriods.find(p => p.key === selectedPeriodKey) || {
      key: defaultPeriodKey,
      label: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
      year: now.getFullYear(),
      month: now.getMonth(),
      type: 'month'
    }
  }, [availablePeriods, selectedPeriodKey, defaultPeriodKey, now])

  // Filter transactions for the selected period (month or year)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return false
      const d = new Date(t.date)
      if (isNaN(d.getTime())) return false
      
      if (selectedPeriod.type === 'month') {
        return d.getFullYear() === selectedPeriod.year && d.getMonth() === selectedPeriod.month
      } else {
        return d.getFullYear() === selectedPeriod.year
      }
    })
  }, [transactions, selectedPeriod])

  // --- KPI CALCULATIONS ---
  const { totalInflow, totalOutflow } = useMemo(() => {
    let inflow = 0
    let outflow = 0
    filteredTransactions.forEach(t => {
      const amt = parseFloat(t.amount || 0)
      if (t.type === 'inflow') {
        inflow += amt
      } else if (t.type === 'outflow' || !t.type) {
        outflow += amt
      }
    })
    return { totalInflow: inflow, totalOutflow: outflow }
  }, [filteredTransactions])

  const netSavings = useMemo(() => totalInflow - totalOutflow, [totalInflow, totalOutflow])
  const savingsRate = useMemo(() => totalInflow > 0 ? (netSavings / totalInflow) * 100 : 0, [netSavings, totalInflow])

  // Burn Rates & Time Averages calculations
  const daysInSelectedMonth = useMemo(() => {
    if (selectedPeriod.type === 'month') {
      return new Date(selectedPeriod.year, selectedPeriod.month + 1, 0).getDate()
    }
    return 0
  }, [selectedPeriod])

  const daysPassed = useMemo(() => {
    if (selectedPeriod.type === 'month') {
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      const currentDay = now.getDate()
      
      if (selectedPeriod.year === currentYear && selectedPeriod.month === currentMonth) {
        return currentDay
      }
      return daysInSelectedMonth
    }
    return 0
  }, [selectedPeriod, now, daysInSelectedMonth])

  const dailyOutflowAverage = useMemo(() => {
    if (selectedPeriod.type === 'month') {
      return daysPassed > 0 ? totalOutflow / daysPassed : 0
    }
    return 0
  }, [selectedPeriod, daysPassed, totalOutflow])

  const monthsPassed = useMemo(() => {
    if (selectedPeriod.type === 'year') {
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      
      if (selectedPeriod.year === currentYear) {
        return currentMonth + 1 // e.g. June = 6 months
      }
      return 12
    }
    return 0
  }, [selectedPeriod, now])

  const monthlyOutflowAverage = useMemo(() => {
    if (selectedPeriod.type === 'year') {
      return monthsPassed > 0 ? totalOutflow / monthsPassed : 0
    }
    return 0
  }, [selectedPeriod, monthsPassed, totalOutflow])

  // --- CHART 1: INFLOW VS OUTFLOW TREND DATA ---
  const trendData = useMemo(() => {
    const data = []

    if (selectedPeriod.type === 'month') {
      const dayInflows = {}
      const dayOutflows = {}

      // Group daily transactions
      filteredTransactions.forEach(t => {
        const d = new Date(t.date)
        const day = d.getDate()
        const amt = parseFloat(t.amount || 0)
        if (t.type === 'inflow') {
          dayInflows[day] = (dayInflows[day] || 0) + amt
        } else {
          dayOutflows[day] = (dayOutflows[day] || 0) + amt
        }
      })

      let cumulativeInflow = 0
      let cumulativeOutflow = 0

      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      const currentDay = now.getDate()

      for (let day = 1; day <= daysInSelectedMonth; day++) {
        // Stop plotting future days of the current month
        if (selectedPeriod.year === currentYear && selectedPeriod.month === currentMonth && day > currentDay) {
          break
        }

        cumulativeInflow += dayInflows[day] || 0
        cumulativeOutflow += dayOutflows[day] || 0
        
        data.push({
          label: `${day}`,
          Inflow: parseFloat(cumulativeInflow.toFixed(2)),
          Outflow: parseFloat(cumulativeOutflow.toFixed(2))
        })
      }
    } else {
      // Yearly view: group by month (0-11)
      const monthInflows = {}
      const monthOutflows = {}

      filteredTransactions.forEach(t => {
        const d = new Date(t.date)
        const month = d.getMonth()
        const amt = parseFloat(t.amount || 0)
        if (t.type === 'inflow') {
          monthInflows[month] = (monthInflows[month] || 0) + amt
        } else {
          monthOutflows[month] = (monthOutflows[month] || 0) + amt
        }
      })

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      let cumulativeInflow = 0
      let cumulativeOutflow = 0

      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()

      for (let m = 0; m < 12; m++) {
        // Stop plotting future months of the current year
        if (selectedPeriod.year === currentYear && m > currentMonth) {
          break
        }

        cumulativeInflow += monthInflows[m] || 0
        cumulativeOutflow += monthOutflows[m] || 0

        data.push({
          label: monthNames[m],
          Inflow: parseFloat(cumulativeInflow.toFixed(2)),
          Outflow: parseFloat(cumulativeOutflow.toFixed(2))
        })
      }
    }
    return data
  }, [filteredTransactions, selectedPeriod, daysInSelectedMonth, now])

  // --- CHART 2: PIE DATA (DYNAMICAL FILTER BY TYPE) ---
  const pieData = useMemo(() => {
    const typeFilteredTransactions = filteredTransactions.filter(t => t.type === donutType)
    
    const categoryTotals = typeFilteredTransactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0)
      return acc
    }, {})

    return Object.entries(categoryTotals).map(([name, value]) => {
      const catObj = categories.find(c => c.name === name)
      return {
        name,
        value: parseFloat(value.toFixed(2)),
        color: catObj ? catObj.color : '#888888'
      }
    })
  }, [filteredTransactions, donutType, categories])

  // --- BUDGET LIMITS & TARGETS WATCHDOG ---
  const expenseCheckpoints = useMemo(() => {
    const categorySpent = {}
    filteredTransactions.forEach(t => {
      if (t.type === 'outflow' || !t.type) {
        categorySpent[t.category] = (categorySpent[t.category] || 0) + parseFloat(t.amount || 0)
      }
    })

    return categories
      .filter(cat => cat.type === 'outflow' || !cat.type)
      .map(cat => {
        const spent = categorySpent[cat.name] || 0
        // Scale budgets by 12 for yearly views
        const budgetLimit = selectedPeriod.type === 'year' ? cat.budget * 12 : cat.budget
        const percentage = budgetLimit > 0 ? (spent / budgetLimit) * 100 : 0
        return {
          ...cat,
          budgetLimit,
          spent,
          percentage: Math.min(100, percentage),
          rawPercentage: percentage,
          overrun: spent > budgetLimit
        }
      })
  }, [filteredTransactions, categories, selectedPeriod])

  const debtsSummary = useMemo(() => {
    let owedToYou = 0
    let youOwe = 0
    let activeCount = 0

    debts.forEach(d => {
      if (d.status === 'pending') {
        const amt = parseFloat(d.amount) || 0
        activeCount++
        if (d.type === 'loan') {
          owedToYou += amt
        } else if (d.type === 'debt') {
          youOwe += amt
        }
      }
    })

    return {
      owedToYou,
      youOwe,
      netBalance: owedToYou - youOwe,
      count: activeCount
    }
  }, [debts])

  const incomeCheckpoints = useMemo(() => {
    const categoryEarned = {}
    filteredTransactions.forEach(t => {
      if (t.type === 'inflow') {
        categoryEarned[t.category] = (categoryEarned[t.category] || 0) + parseFloat(t.amount || 0)
      }
    })

    return categories
      .filter(cat => cat.type === 'inflow')
      .map(cat => {
        const earned = categoryEarned[cat.name] || 0
        // Scale revenue targets by 12 for yearly views
        const targetLimit = selectedPeriod.type === 'year' ? cat.budget * 12 : cat.budget
        const percentage = targetLimit > 0 ? (earned / targetLimit) * 100 : 0
        return {
          ...cat,
          targetLimit,
          earned,
          percentage: Math.min(100, percentage),
          rawPercentage: percentage,
          completed: earned >= targetLimit
        }
      })
  }, [filteredTransactions, categories, selectedPeriod])

  // Helper for rendering currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* --- DASHBOARD FILTER BAR --- */}
      <div className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={20} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Analysis Period:</span>
        </div>
        <select 
          className="select-filter" 
          value={selectedPeriodKey} 
          onChange={(e) => setSelectedPeriodKey(e.target.value)}
          style={{ minWidth: '220px', cursor: 'pointer' }}
        >
          {availablePeriods.map(p => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* --- KPI METRICS GRID --- */}
      <section className="metrics-grid">
        
        {/* Card 1: Total Inflow */}
        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Total Inflow</span>
            <span className="metric-value" style={{ color: 'var(--success)' }}>
              {formatCurrency(totalInflow)}
            </span>
            <span className="metric-subtext positive" style={{ color: 'var(--success)' }}>
              <ArrowUpRight size={14} /> Cash Inflow
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--success)', borderLeft: '3px solid var(--success)' }}>
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Card 2: Total Outflow */}
        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Total Outflow</span>
            <span className="metric-value" style={{ color: 'var(--danger)' }}>
              {formatCurrency(totalOutflow)}
            </span>
            <span className="metric-subtext negative" style={{ color: 'var(--danger)' }}>
              <ArrowDownRight size={14} /> Cash Outflow
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--danger)', borderLeft: '3px solid var(--danger)' }}>
            <TrendingDown size={24} />
          </div>
        </div>

        {/* Card 3: Net Balance */}
        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Net Reserves</span>
            <span className="metric-value" style={{ color: netSavings >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
              {formatCurrency(netSavings)}
            </span>
            <span className={`metric-subtext ${netSavings >= 0 ? 'positive' : 'negative'}`}>
              Savings Rate: {savingsRate.toFixed(1)}%
            </span>
          </div>
          <div className="metric-icon-box" style={{ color: 'var(--primary)', borderLeft: '3px solid var(--primary)' }}>
            <Scale size={24} />
          </div>
        </div>

        {/* Card 4: Daily Expense Burn or Monthly Average */}
        {selectedPeriod.type === 'month' ? (
          <div className="card metric-card">
            <div className="metric-info">
              <span className="metric-label">Daily Outflow Burn</span>
              <span className="metric-value">
                {formatCurrency(dailyOutflowAverage)}
              </span>
              <span className="metric-subtext">
                Tracked across {daysPassed} days
              </span>
            </div>
            <div className="metric-icon-box" style={{ color: 'var(--secondary)', borderLeft: '3px solid var(--secondary)' }}>
              <Calendar size={24} />
            </div>
          </div>
        ) : (
          <div className="card metric-card">
            <div className="metric-info">
              <span className="metric-label">Monthly Average Burn</span>
              <span className="metric-value">
                {formatCurrency(monthlyOutflowAverage)}
              </span>
              <span className="metric-subtext">
                Tracked across {selectedPeriod.year} data
              </span>
            </div>
            <div className="metric-icon-box" style={{ color: 'var(--secondary)', borderLeft: '3px solid var(--secondary)' }}>
              <Calendar size={24} />
            </div>
          </div>
        )}

        {/* Card 5: Debts & Loans Summary */}
        <div className="card metric-card">
          <div className="metric-info">
            <span className="metric-label">Debts & Loans</span>
            <span className="metric-value" style={{ color: debtsSummary.netBalance > 0 ? 'var(--success)' : debtsSummary.netBalance < 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {formatCurrency(debtsSummary.netBalance)}
            </span>
            <span className="metric-subtext" style={{ color: debtsSummary.netBalance > 0 ? 'var(--success)' : debtsSummary.netBalance < 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {debtsSummary.count > 0 
                ? `${debtsSummary.count} pending ${debtsSummary.count === 1 ? 'entry' : 'entries'}`
                : 'No active obligations'}
            </span>
          </div>
          <div className="metric-icon-box" style={{ 
            color: debtsSummary.netBalance > 0 ? 'var(--success)' : debtsSummary.netBalance < 0 ? 'var(--warning)' : 'var(--secondary)', 
            borderLeft: `3px solid ${debtsSummary.netBalance > 0 ? 'var(--success)' : debtsSummary.netBalance < 0 ? 'var(--warning)' : 'var(--secondary)'}` 
          }}>
            <Coins size={24} />
          </div>
        </div>

      </section>

      {/* --- DASHBOARD CHARTS & BUDGET BREAKDOWN --- */}
      <section className="dashboard-grid">
        
        {/* Left Column: Cumulative Cash Trend (Inflow vs Outflow) */}
        <div className="card chart-card">
          <div className="chart-header">
            <h3>Cumulative Cash Flow</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {selectedPeriod.label}
            </span>
          </div>
          <div className="chart-container">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="label" 
                    stroke="var(--text-muted)" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="var(--text-muted)" 
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(tick) => `₹${tick}`}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }}
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(label) => selectedPeriod.type === 'year' ? `Month: ${label}` : `Day ${label} of Month`}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area 
                    type="monotone" 
                    name="Total Inflow"
                    dataKey="Inflow" 
                    stroke="var(--success)" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorInflow)" 
                  />
                  <Area 
                    type="monotone" 
                    name="Total Outflow"
                    dataKey="Outflow" 
                    stroke="var(--primary)" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorOutflow)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No transaction data available for this period.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Category Breakdown (Inflow vs Outflow toggle) */}
        <div className="card chart-card">
          <div className="chart-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3>Category Breakdown</h3>
            <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-card-hover)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
              <button 
                style={{ 
                  background: donutType === 'outflow' ? 'var(--primary)' : 'none', 
                  border: 'none', 
                  color: donutType === 'outflow' ? 'white' : 'var(--text-secondary)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
                onClick={() => setDonutType('outflow')}
              >
                Outflow
              </button>
              <button 
                style={{ 
                  background: donutType === 'inflow' ? 'var(--success)' : 'none', 
                  border: 'none', 
                  color: donutType === 'inflow' ? 'white' : 'var(--text-secondary)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
                onClick={() => setDonutType('inflow')}
              >
                Inflow
              </button>
            </div>
          </div>
          <div className="chart-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                       data={pieData}
                       cx="50%"
                       cy="50%"
                       innerRadius={65}
                       outerRadius={85}
                       paddingAngle={4}
                       dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-card)', 
                        borderColor: 'var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                      formatter={(value) => [formatCurrency(value), 'Amount']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text for Donut Chart */}
                <div style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {donutType === 'outflow' ? 'Total Outflow' : 'Total Inflow'}
                  </span>
                  <span style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                    {formatCurrency(donutType === 'outflow' ? totalOutflow : totalInflow)}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No transactions logged for {donutType} categories.
              </div>
            )}
          </div>
        </div>

      </section>

      {/* --- LIMITS & TARGETS DETAILED REPORT --- */}
      <div className="dashboard-grid grid-2col">
        
        {/* Card 1: Outflow Limits (Budgets) */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="chart-header">
            <h3>Outflow Allowance Limits</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {selectedPeriod.type === 'year' ? 'Yearly Caps' : 'Monthly Caps'}
            </span>
          </div>
          <div className="budget-progress-list">
            {expenseCheckpoints.map(cat => (
              <div key={cat.name} className="budget-progress-item">
                <div className="budget-progress-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="category-color-indicator" style={{ backgroundColor: cat.color }}></span>
                    {cat.name}
                    {cat.overrun && (
                      <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                        <AlertTriangle size={14} /> Overlimit
                      </span>
                    )}
                  </span>
                  <span style={{ color: cat.overrun ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    {formatCurrency(cat.spent)} / {formatCurrency(cat.budgetLimit)}
                  </span>
                </div>
                <div className="budget-progress-bar-bg">
                  <div 
                    className="budget-progress-bar-fill" 
                    style={{ 
                      width: `${cat.percentage}%`, 
                      backgroundColor: cat.overrun ? 'var(--danger)' : cat.color 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Card 2: Inflow Targets (Revenue goals) */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="chart-header">
            <h3>Inflow Revenue Targets</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {selectedPeriod.type === 'year' ? 'Yearly Goals' : 'Monthly Goals'}
            </span>
          </div>
          <div className="budget-progress-list">
            {incomeCheckpoints.map(cat => (
              <div key={cat.name} className="budget-progress-item">
                <div className="budget-progress-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="category-color-indicator" style={{ backgroundColor: cat.color }}></span>
                    {cat.name}
                    {cat.completed && (
                      <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        ✅ Met
                      </span>
                    )}
                  </span>
                  <span style={{ color: cat.completed ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {formatCurrency(cat.earned)} / {formatCurrency(cat.targetLimit)}
                  </span>
                </div>
                <div className="budget-progress-bar-bg">
                  <div 
                    className="budget-progress-bar-fill" 
                    style={{ 
                      width: `${cat.percentage}%`, 
                      backgroundColor: cat.completed ? 'var(--success)' : 'var(--info)' 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

    </div>
  )
}
