// Testing utilities for Swoono development

export const TESTING_CONFIG = {
  // Auto-grant maximum points for testing
  AUTO_GRANT_POINTS: 50000,

  // Bypass all payment restrictions
  BYPASS_PAYMENTS: true,

  // Enable all PRO features
  FORCE_PRO_ACCESS: true,

  // Skip wait times and cooldowns
  SKIP_TIMERS: true,

  // Show debugging info
  VERBOSE_LOGGING: true
} as const;

export const isTestingMode = (): boolean => {
  return import.meta.env.VITE_TESTER_MODE === "true";
};

export const log = (message: string, ...args: any[]) => {
  if (TESTING_CONFIG.VERBOSE_LOGGING && isTestingMode()) {
    console.log(`[SWOONO TEST] ${message}`, ...args);
  }
};

export const setupTestingEnvironment = () => {
  if (!isTestingMode()) return;

  log("Testing environment initialized");

  // Auto-grant points after a short delay
  setTimeout(() => {
    const pointsStore = (window as any).__SWOONO_STORES__?.points;
    if (pointsStore && TESTING_CONFIG.AUTO_GRANT_POINTS > 0) {
      pointsStore.getState().award(TESTING_CONFIG.AUTO_GRANT_POINTS, "Auto-testing points");
      log(`Granted ${TESTING_CONFIG.AUTO_GRANT_POINTS} testing points`);
    }
  }, 1000);

  // Add testing helper to global scope
  (window as any).__SWOONO_TESTING__ = {
    grantPoints: (amount: number) => {
      const pointsStore = (window as any).__SWOONO_STORES__?.points;
      pointsStore?.getState().award(amount, "Manual testing points");
      log(`Manually granted ${amount} points`);
    },

    unlockPro: () => {
      const subStore = (window as any).__SWOONO_STORES__?.subscription;
      subStore?.getState().setTestingMode(true, "pro");
      log("PRO access unlocked");
    },

    resetToFree: () => {
      const subStore = (window as any).__SWOONO_STORES__?.subscription;
      subStore?.getState().setTestingMode(true, "free");
      log("Reset to FREE tier");
    },

    testAllRewards: () => {
      log("All rewards should be testable now - unlimited points + PRO access");
    }
  };

  log("Testing helpers available at: window.__SWOONO_TESTING__");
};

// Initialize testing when this module loads
if (isTestingMode()) {
  setupTestingEnvironment();
}