# RupeeWise — Premium Expense & Inflow Tracker

RupeeWise is a premium, secure, and mobile-friendly expenditure and inflow tracking web application. It is designed to run locally on your PC/mobile devices as an installable Progressive Web App (PWA) and synchronize automatically with your spreadsheet (Google Sheets) via robust n8n workflows hosted on Azure App Service.

---

## 🌟 Visual & Interactive Features

- **Dynamic Financial Dashboard**: Visualizes your monthly spent vs. budget, daily burn rate, and top categories using interactive charts (`recharts`).
- **Flexible Data Journal**: Sort, search, and filter expenditures by description, category, payment method, or date range on both desktop and mobile layouts.
- **Budget Guardrails**: Set custom monthly allowances and colors per category. Highlights visual overruns with warning indicators.
- **Dual Database Sync**: Boots in **Local Storage Mode** (offline, zero-configuration) and supports toggling **n8n Sync Mode** in settings for automatic cloud synchronization.
- **Rich responsive aesthetics**: Designed with a sleek dark-mode glassmorphic interface, soft radial gradients, modern typography (Outfit/Inter), and micro-animations.

---

## ⚙️ How to Set Up n8n and Sync your Google Sheet

### 1. Import the Workflow
1. Open your n8n workspace and create a new workflow.
2. Click the options menu (top right) and select **Import from File**. Upload the [n8n_workflows.json](n8n_workflows.json) from this project workspace.

### 2. Configure your Google Sheets Node
1. The imported template uses **Google Sheets** (standard, secure, and fully mobile-compatible).
2. Double-click the Sheet nodes (*Read Transactions*, *Read Categories*, *Append Transaction*, etc.) and connect your Google Account.
3. Specify your spreadsheet ID and select the matching sheet tabs.
4. Make sure your sheet has the following column headers in Row 1:
   - **Sheet 1 (`Transactions`)**: `ID`, `Date`, `Category`, `Amount`, `Description`, `Payment Method`, `Status`, `Created At`, `Updated At`, `Source Device`
   - **Sheet 2 (`Categories`)**: `name`, `budget`, `color`

### 3. Secure the Webhook
1. In the **Verify Auth Key** node, set your custom secret key.
2. Save the n8n workflow and change the active status toggle to **Active** (production mode).

### 4. Enable Sync in the App
1. Open the **RupeeWise** web app.
2. Navigate to the **Settings** tab.
3. Toggle **Enable n8n Database Sync**.
4. Input your n8n Webhook URL (copied from the n8n Webhook node) and your secret **Auth Token**.
5. Click **Test Webhook Connection**. Once verified, click **Sync Database Now**.

---

## 🛡️ Security & ISO Compliance Standards

To protect your financial logs and align with standard enterprise security parameters (such as ISO/IEC 27001 and OWASP rules), we implemented the following:

1. **Access Control (ISO 27001 A.9)**: The frontend app sends an `X-API-KEY` authorization header with every API request. The n8n webhook intercepts and blocks any request that doesn't supply the matching key (returning HTTP 401).
2. **Formula Injection Guard (OWASP Top 10)**: Strips leading formula indicators (`=`, `+`, `-`, `@`, `|`, `%`) from user text fields. This guarantees that if you download/open the spreadsheet locally, no malicious macros or commands can run.
3. **Audit Logging (ISO 27001 A.12.4)**: Every transaction generated logs:
   - Unique identifier (`id` UUID).
   - Date created & Date modified (`createdAt` / `updatedAt` ISO 8601).
   - Source device footprint (`sourceDevice`: "Mobile", "Desktop", "Tablet").
4. **Data Privacy (ISO 29100)**: No external analytics or third-party trackers are integrated. All your data remains private between your browser, your n8n instance, and your own cloud spreadsheet.

---

## ⚡ Performance Optimizations & PWA Offline Sync

The application includes advanced performance and network layers to support poor internet connectivity and offline states:

- **Zero Mobile Lag via React Memoization**: All monthly transaction filtering, KPI sums, daily expenditure averages, and category donut breakdowns use React `useMemo` hooks.
- **Fail-Fast Network Timeouts**: Integrated `fetchWithTimeout` using browser `AbortController`. If a sync attempt doesn't complete within 90 seconds for manual connection tests / database reads (8 seconds for silent background polling), it aborts to save network resource consumption on mobile devices.
- **Safe Mutation Queueing**: Transactions logged while offline are written locally first and marked as `syncPending`. Once connection is restored, the queue is automatically flushed sequentially.

---

## 💻 Running the App Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Install as a Standalone App (PWA)
- **On PC (Chrome/Edge)**: Click the **Install** icon in the browser address bar.
- **On Android (Chrome)**: Tap the **Add to Home Screen** banner.
- **On iOS (Safari)**: Open the Share sheet on Safari and tap **Add to Home Screen**.
