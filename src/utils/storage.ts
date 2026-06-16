const PENDING_KEY = 'spend_pending_mutations';
const TRANSACTIONS_KEY = 'spend_transactions';
const CATEGORIES_KEY = 'spend_categories';
const MAX_PENDING = 500;
const MAX_TRANSACTIONS = 10000;
const QUEUE_WARNING_THRESHOLD = 450;

let queueWarningCallback = null;

export function setQueueWarningCallback(callback) {
  queueWarningCallback = callback;
}

function notifyQueueWarning(count) {
  if (queueWarningCallback) {
    queueWarningCallback(count);
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      if (key === TRANSACTIONS_KEY) {
        purgeOldTransactions();
      } else if (key === PENDING_KEY) {
        purgeOldPending();
      }
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('storage-quota-exceeded', { detail: { key } }));
        }
        return false;
      }
    }
    throw e;
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function purgeOldPending(): void {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    if (pending.length > MAX_PENDING) {
      const trimmed = pending.slice(-MAX_PENDING);
      localStorage.setItem(PENDING_KEY, JSON.stringify(trimmed));
    }
  } catch {
  }
}

function purgeOldTransactions(): void {
  try {
    const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
    if (transactions.length > MAX_TRANSACTIONS) {
      const trimmed = transactions.slice(-MAX_TRANSACTIONS);
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(trimmed));
    }
  } catch {
  }
}

export function addPendingMutation(mutation: object): void {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    pending.push({ ...mutation, timestamp: Date.now() });
    if (pending.length > MAX_PENDING) {
      pending.shift()
      notifyQueueWarning(pending.length)
    } else if (pending.length >= QUEUE_WARNING_THRESHOLD) {
      notifyQueueWarning(pending.length)
    }
    safeSetItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
  }
}

export function getPendingMutations(): object[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearPendingMutations(): void {
  safeRemoveItem(PENDING_KEY);
}

export function removePendingMutation(index: number): void {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    if (index >= 0 && index < pending.length) {
      pending.splice(index, 1);
      safeSetItem(PENDING_KEY, JSON.stringify(pending));
    }
  } catch {
  }
}

export function getOfflineQueueStatus() {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    return {
      count: pending.length,
      maxSize: MAX_PENDING,
      isNearCapacity: pending.length >= QUEUE_WARNING_THRESHOLD,
      isFull: pending.length >= MAX_PENDING
    };
  } catch {
    return {
      count: 0,
      maxSize: MAX_PENDING,
      isNearCapacity: false,
      isFull: false
    };
  }
}