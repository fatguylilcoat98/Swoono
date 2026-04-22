import { create } from "zustand";

export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";

type SubscriptionState = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isLoading: boolean;
  currentPeriodEnd: string | null;

  // Testing overrides
  testingMode: boolean;
  testPlan: SubscriptionPlan;

  // Actions
  setPlan: (plan: SubscriptionPlan, status: SubscriptionStatus) => void;
  setTestingMode: (enabled: boolean, testPlan?: SubscriptionPlan) => void;
  fetchSubscription: (clientId: string) => Promise<void>;
};

// Check if we're in testing mode from environment
const isTestingMode = import.meta.env.VITE_TESTER_MODE === "true";

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plan: isTestingMode ? "pro" : "free",
  status: isTestingMode ? "active" : "inactive",
  isLoading: false,
  currentPeriodEnd: null,
  testingMode: isTestingMode,
  testPlan: "pro",

  setPlan: (plan, status) => {
    set({ plan, status, isLoading: false });
  },

  setTestingMode: (enabled, testPlan = "pro") => {
    set({
      testingMode: enabled,
      testPlan,
      plan: enabled ? testPlan : "free",
      status: enabled ? "active" : "inactive"
    });
  },

  fetchSubscription: async (clientId: string) => {
    const { testingMode, testPlan } = get();

    // In testing mode, always return PRO
    if (testingMode) {
      set({
        plan: testPlan,
        status: "active",
        isLoading: false,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      return;
    }

    set({ isLoading: true });

    try {
      const response = await fetch(`/api/stripe/subscription/${clientId}`);
      const data = await response.json();

      set({
        plan: data.plan || "free",
        status: data.status || "inactive",
        currentPeriodEnd: data.currentPeriodEnd,
        isLoading: false
      });
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
      set({
        plan: "free",
        status: "inactive",
        isLoading: false
      });
    }
  }
}));

// Helper functions for checking access
export const hasProAccess = () => {
  const { plan, status, testingMode, testPlan } = useSubscriptionStore.getState();

  if (testingMode) {
    return testPlan === "pro";
  }

  return plan === "pro" && status === "active";
};

export const canAccessReward = (cost: number) => {
  const { testingMode } = useSubscriptionStore.getState();

  // In testing mode, all rewards are accessible regardless of cost
  if (testingMode) {
    return true;
  }

  // Regular logic would check subscription + points here
  return hasProAccess() || cost <= 100; // Example threshold
};