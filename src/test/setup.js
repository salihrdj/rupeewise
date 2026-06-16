import '@testing-library/jest-dom'

// Mock offsetWidth and offsetHeight for JSDOM layout-dependent code
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return this.style.display === 'none' ? 0 : 100;
  }
});

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    return this.style.display === 'none' ? 0 : 30;
  }
});
