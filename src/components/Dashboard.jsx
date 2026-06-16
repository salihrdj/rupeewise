import React, { useState, useMemo } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Scale
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

export default function Dashboard({ transactions = [], categories = [] }) {
  // Toggle for donut chart breakdown
  const [donutType, setDonutType] = useState('outflow')

  // Get current year and month for active monitoring
  const now = useMemo(() => new Date(), [])
  const currentYear = useMemo(() => now.getFullYear(), [now])
  const currentMonth = useMemo(() => now.getMonth(), [now]) // 0-indexed

  // Filter transactions for the current calendar month
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
    })
  }, [transactions, currentYear, currentMonth])

  // --- KPI CALCULATIONS ---
  const { totalInflow, totalOutflow } = useMemo(() => {
    let inflow = 0
    let outflow = 0
    currentMonthTransactions.forEach(t => {
      const amt = parseFloat(t.amount || 0)
      if (t.type === 'inflow') {
        inflow += amt
      } else if (t.type === 'outflow' || !t.type) {
        outflow += amt
      }
    })
    return { totalInflow: inflow, totalOutflow: outflow }
  }, [currentMonthTransactions])

  const netSavings = useMemo(() => totalInflow - totalOutflow, [totalInflow, totalOutflow])
  const savingsRate = useMemo(() => totalInflow > 0 ? (netSavings / totalInflow) * 100 : 0, [netSavings, totalInflow])

  // Daily average calculation (only for outflows/expenses)
  const daysInCurrentMonth = useMemo(() => new Date(currentYear, currentMonth + 1, 0).getDate(), [currentYear, currentMonth])
  const currentDay = useMemo(() => now.getDate(), [now])
  const daysPassed = useMemo(() => now.getMonth() === currentMonth ? currentDay : daysInCurrentMonth, [now, currentMonth, currentDay, daysInCurrentMonth])
  const dailyOutflowAverage = useMemo(() => daysPassed > 0 ? totalOutflow / daysPassed : 0, [daysPassed, totalOutflow])

  // --- CHART 1: INFLOW VS OUTFLOW TREND DATA ---
  const dailyTrendData = useMemo(() => {
    const data = []
    const dayInflows = {}
    const dayOutflows = {}

    // Group transactions by day of month
    currentMonthTransactions.forEach(t => {
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

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      // Only plot up to today if it's the current month
      if (now.getMonth() === currentMonth && day > currentDay) {
        break
      }

      cumulativeInflow += dayInflows[day] || 0
      cumulativeOutflow += dayOutflows[day] || 0
      
      data.push({
        day: `${day}`,
        Inflow: parseFloat(cumulativeInflow.toFixed(2)),
        Outflow: parseFloat(cumulativeOutflow.toFixed(2))
      })
    }
    return data
  }, [currentMonthTransactions, daysInCurrentMonth, currentMonth, currentDay, now])

  // --- CHART 2: PIE DATA (DYNAMICAL FILTER BY TYPE) ---
  const pieData = useMemo(() => {
    const typeFilteredTransactions = currentMonthTransactions.filter(t => t.type === donutType)
    
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
  }, [currentMonthTransactions, donutType, categories])

  // --- BUDGET LIMITS & TARGETS WATCHDOG ---
  const expenseCheckpoints = useMemo(() => {
    // Pre-group transactions of the current month by category for quick lookup
    const categorySpent = {}
    transactions.forEach(t => {
      const d = new Date(t.date)
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth && (t.type === 'outflow' || !t.type)) {
        categorySpent[t.category] = (categorySpent[t.category] || 0) + parseFloat(t.amount || 0)
      }
    })

    return categories
      .filter(cat => cat.type === 'outflow' || !cat.type) // default to outflow
      .map(cat => {
        const spent = categorySpent[cat.name] || 0
        const percentage = cat.budget > 0 ? (spent / cat.budget) * 100 : 0
        return {
          ...cat,
          spent,
          percentage: Math.min(100, percentage),
          rawPercentage: percentage,
          overrun: spent > cat.budget
        }
      })
  }, [transactions, categories, currentYear, currentMonth])

  const incomeCheckpoints = useMemo(() => {
    // Pre-group transactions of the current month by category for quick lookup
    const categoryEarned = {}
    transactions.forEach(t => {
      const d = new Date(t.date)
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth && t.type === 'inflow') {
        categoryEarned[t.category] = (categoryEarned[t.category] || 0) + parseFloat(t.amount || 0)
      }
    })

    return categories
      .filter(cat => cat.type === 'inflow')
      .map(cat => {
        const earned = categoryEarned[cat.name] || 0
        const percentage = cat.budget > 0 ? (earned / cat.budget) * 100 : 0
        return {
          ...cat,
          earned,
          percentage: Math.min(100, percentage),
          rawPercentage: percentage,
          completed: earned >= cat.budget
        }
      })
  }, [transactions, categories, currentYear, currentMonth])

  // Helper for rendering currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
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

        {/* Card 4: Daily Expense Burn */}
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

      </section>

      {/* --- DASHBOARD CHARTS & BUDGET BREAKDOWN --- */}
      <section className="dashboard-grid">
        
        {/* Left Column: Cumulative Cash Trend (Inflow vs Outflow) */}
        <div className="card chart-card">
          <div className="chart-header">
            <h3>Cumulative Cash Flow</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Current Calendar Month
            </span>
          </div>
          <div className="chart-container">
            {dailyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    dataKey="day" 
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
                    labelFormatter={(label) => `Day ${label} of Month`}
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
                No transaction data available for this month.
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
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Monthly Caps</span>
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
                    {formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}
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
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Monthly Goals</span>
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
                    {formatCurrency(cat.earned)} / {formatCurrency(cat.budget)}
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
