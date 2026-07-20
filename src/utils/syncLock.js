const SYNC_CHANNEL_NAME = 'spend-sync-lock';
const LOCK_KEY = 'spend-sync-lock-held';
const LOCK_TIMEOUT = 5000;

let broadcastChannel = null;
let isLockHeld = false;
let lockReleaseCallbacks = [];

function getBroadcastChannel() {
  if (typeof window === 'undefined') return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return broadcastChannel;
}

function acquireLock() {
  if (typeof window === 'undefined') return Promise.resolve(true);
  
  const channel = getBroadcastChannel();
  
  return new Promise((resolve) => {
    const tryAcquire = () => {
      const existingLock = localStorage.getItem(LOCK_KEY);
      const lockTime = existingLock ? parseInt(existingLock, 10) : 0;
      const now = Date.now();
      
      if (!existingLock || (now - lockTime) > LOCK_TIMEOUT) {
        localStorage.setItem(LOCK_KEY, now.toString());
        isLockHeld = true;
        
        if (channel) {
          channel.postMessage({ type: 'LOCK_ACQUIRED', timestamp: now });
        }
        resolve(true);
        return;
      }
      
      setTimeout(tryAcquire, 50);
    };
    
    tryAcquire();
  });
}

function releaseLock() {
  if (typeof window === 'undefined') return Promise.resolve();
  
  const channel = getBroadcastChannel();
  localStorage.removeItem(LOCK_KEY);
  isLockHeld = false;
  
  if (channel) {
    channel.postMessage({ type: 'LOCK_RELEASED', timestamp: Date.now() });
  }
  
  lockReleaseCallbacks.forEach(cb => cb());
  lockReleaseCallbacks = [];
  
  return Promise.resolve();
}

function onLockReleased(callback) {
  lockReleaseCallbacks.push(callback);
  
  const channel = getBroadcastChannel();
  if (channel) {
    const handler = (event) => {
      if (event.data.type === 'LOCK_RELEASED') {
        callback();
      }
    };
    channel.addEventListener('message', handler);
    return () => channel.removeEventListener('message', handler);
  }
  
  return () => {
    const idx = lockReleaseCallbacks.indexOf(callback);
    if (idx > -1) lockReleaseCallbacks.splice(idx, 1);
  };
}

function withLock(fn) {
  return acquireLock()
    .then(() => {
      try {
        const result = fn();
        return Promise.resolve(result).finally(() => releaseLock());
      } catch (e) {
        releaseLock();
        throw e;
      }
    });
}

async function withLockAsync(fn) {
  await acquireLock();
  try {
    return await fn();
  } finally {
    await releaseLock();
  }
}

export { acquireLock, releaseLock, onLockReleased, withLock, withLockAsync, isLockHeld };