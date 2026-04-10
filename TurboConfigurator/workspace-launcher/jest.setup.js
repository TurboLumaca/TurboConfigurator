import '@testing-library/jest-dom';

if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

jest.mock('@tauri-apps/api/core', () => ({
  isTauri: jest.fn(() => false),
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: jest.fn(async () => false),
  enable: jest.fn(async () => {}),
  disable: jest.fn(async () => {}),
}));

jest.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: jest.fn(async () => {}),
  unregisterAll: jest.fn(async () => {}),
}));

jest.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: jest.fn(async () => {}),
  openPath: jest.fn(async () => {}),
}));

jest.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: jest.fn(async () => ({
      get: jest.fn(async () => undefined),
      set: jest.fn(async () => {}),
      save: jest.fn(async () => {}),
      delete: jest.fn(async () => {}),
    })),
  },
}));
