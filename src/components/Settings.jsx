import React, { useState } from 'react'
import { 
  Wifi, 
  WifiOff, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  HelpCircle 
} from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { fetchWithTimeout } from '../utils/fetchWithTimeout'
import { safeSetItem } from '../utils/storage'

export default function Settings({
  onSync,
  isSyncing,
  transactions,
  categories,
  setTransactions,
  setCategories
}) {
  const [showToken, setShowToken] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [isTesting, setIsTesting] = useState(false)

  // Consume Settings Context
  const {
    isN8nMode,
    setIsN8nMode,
    n8nUrl,
    setN8nUrl,
    n8nToken,
    setN8nToken
  } = useSettings()

  const handleToggleMode = (e) => {
    setIsN8nMode(e.target.checked)
  }

  const handleUrlChange = (e) => {
    setN8nUrl(e.target.value)
  }

  const handleTokenChange = (e) => {
    setN8nToken(e.target.value)
  }

  // Test n8n Webhook connection
  const testConnection = async () => {
    if (!n8nUrl) {
      setTestResult({ success: false, message: 'Please provide an n8n Webhook URL first.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetchWithTimeout(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': n8nToken
        },
        body: JSON.stringify({ action: 'fetch' })
      }, 90000)

      if (response.ok) {
        const resData = await response.json()
        if (resData.syncErrors && (resData.syncErrors.transactions || resData.syncErrors.categories)) {
          const failedSheets = []
          if (resData.syncErrors.transactions) failedSheets.push('Transactions')
          if (resData.syncErrors.categories) failedSheets.push('Categories')
          setTestResult({
            success: false,
            message: `Connected to n8n, but Google Sheet read failed for: ${failedSheets.join(', ')}. Please verify Sheet names, column headers, and credentials in n8n.`
          })
        } else if (resData.transactions && resData.categories) {
          setTestResult({ 
            success: true, 
            message: `Connection successful! Fetched ${resData.transactions.length} transactions and ${resData.categories.length} categories.` 
          })
        } else {
          setTestResult({ 
            success: true, 
            message: 'Connection successful, but database format is uninitialized (missing transactions/categories arrays).' 
          })
        }
      } else {
        if (response.status === 401) {
          throw new Error('Unauthorized. Invalid X-API-KEY/Auth Token.')
        }
        throw new Error(`Server returned error code: ${response.status}`)
      }
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: `Connection failed: ${err.message}. Make sure CORS is enabled in n8n.` 
      })
    } finally {
      setIsTesting(false)
    }
  }

  // Database Backup: Export JSON
  const exportDatabase = () => {
    const db = {
      transactions,
      categories,
      exportedAt: new Date().toISOString()
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `spend_tracker_backup_${new Date().toISOString().split('T')[0]}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Database Backup: Import JSON
  const importDatabase = (e) => {
    const fileReader = new FileReader()
    const file = e.target.files[0]
    if (!file) return

    fileReader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result)
        if (!importedData.transactions || !importedData.categories) {
          alert('Invalid backup file. Missing transactions or categories keys.')
          return
        }

        if (window.confirm(`Importing backup will replace all current data. Are you sure you want to proceed?`)) {
          setTransactions(importedData.transactions)
          setCategories(importedData.categories)
          safeSetItem('spend_transactions', JSON.stringify(importedData.transactions))
          safeSetItem('spend_categories', JSON.stringify(importedData.categories))
          alert('Database restored successfully!')
        }
      } catch (err) {
        alert('Failed to parse JSON backup file.')
      }
    }
    fileReader.readAsText(file)
  }

  // Revert / Reset database to defaults
  const resetDatabase = () => {
    if (window.confirm('WARNING: This will permanently delete all logged expenditures and reset categories to factory defaults. This action CANNOT be undone. Proceed?')) {
      localStorage.removeItem('spend_transactions')
      localStorage.removeItem('spend_categories')
      window.location.reload()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* --- INTEGRATION CONFIGURATION --- */}
      <section className="card settings-card">
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', width: '100%' }}>
          <h3>n8n Workflow Synchronization</h3>
        </div>

        <div className="settings-row" style={{ marginTop: '0.5rem' }}>
          <div className="settings-meta">
            <span className="settings-title">Enable n8n Database Sync</span>
            <span className="settings-desc">Routes all data transactions directly to Excel Online/Google Sheets via n8n webhooks.</span>
          </div>
          <div>
            <label className="switch-box">
              <input 
                type="checkbox" 
                checked={isN8nMode}
                onChange={handleToggleMode}
              />
              <span className="switch-slider"></span>
            </label>
          </div>
        </div>

        {isN8nMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
            
            {/* Webhook Endpoint Input */}
            <div className="form-group">
              <label htmlFor="n8n-url-input">n8n Webhook URL</label>
              <input 
                id="n8n-url-input"
                type="url" 
                className="form-input" 
                placeholder="https://primary-n8n.yourdomain.com/webhook/expenditures"
                value={n8nUrl}
                onChange={handleUrlChange}
              />
            </div>

            {/* Auth Token Input */}
            <div className="form-group">
              <label htmlFor="n8n-token-input">n8n Auth Token (X-API-KEY)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  id="n8n-token-input"
                  type={showToken ? 'text' : 'password'} 
                  className="form-input" 
                  placeholder="Enter secret webhook authorization key"
                  value={n8nToken}
                  onChange={handleTokenChange}
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button 
                  type="button"
                  style={{ 
                    position: 'absolute', 
                    right: '0.75rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
              <button 
                className="btn btn-secondary"
                onClick={testConnection}
                disabled={isTesting}
              >
                {isTesting ? <RefreshCw size={16} className="spinning" /> : <Wifi size={16} />}
                <span>Test Webhook Connection</span>
              </button>

              <button 
                className="btn btn-primary"
                onClick={onSync}
                disabled={isSyncing}
              >
                <RefreshCw size={16} className={isSyncing ? 'spinning' : ''} />
                <span>Sync Database Now</span>
              </button>
            </div>

            {isTesting && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                ⌛ Testing connection... (Waking up server can take a few moments on the first request)
              </p>
            )}

            {/* Test Connection result status */}
            {testResult && (
              <div className={`alert-banner ${testResult.success ? 'success' : 'danger'}`} style={{ position: 'static', transform: 'none', animation: 'none', marginTop: '0.5rem' }}>
                <ShieldAlert size={20} />
                <span>{testResult.message}</span>
              </div>
            )}

          </div>
        )}
      </section>

      {/* --- DATABASE BACKUP & RESTORE --- */}
      <section className="card">
        <h3>Local Database Backups</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          Create snapshots of your financial records to store on your local disk or migrate to another browser.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Export button */}
          <button className="btn btn-secondary" onClick={exportDatabase}>
            <Download size={16} />
            <span>Export database (JSON)</span>
          </button>

          {/* Import file wrap */}
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} />
            <span>Import database (JSON)</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={importDatabase}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </section>

      {/* --- DANGER ZONE --- */}
      <section className="card" style={{ borderColor: 'var(--danger-glow)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
        <h3 style={{ color: 'var(--danger)' }}>System Risk Zone</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          Performing these operations resets state. Please double-check before executing.
        </p>
        <div>
          <button className="btn btn-danger" onClick={resetDatabase}>
            <Trash2 size={16} />
            <span>Wipe All Local Databases</span>
          </button>
        </div>
      </section>

    </div>
  )
}
