import { create } from "zustand";
import { isAdmin } from "../lib/admin";

export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";

type SubscriptionState = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isLoading: boolean;
  currentPeriodEnd: string | null;

  // Admin overrides
  adminMode: boolean;
  adminPlan: SubscriptionPlan;

  // Actions
  setPlan: (plan: SubscriptionPlan, status: SubscriptionStatus) => void;
  setAdminMode: (enabled: boolean, adminPlan?: SubscriptionPlan) => void;
  fetchSubscription: (clientId: string) => Promise<void>;
};

// Check if current user is admin
const adminAccess = isAdmin();

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plan: adminAccess ? "pro" : "free",
  status: adminAccess ? "active" : "inactive",
  isLoading: false,
  currentPeriodEnd: null,
  adminMode: adminAccess,
  adminPlan: "pro",

  setPlan: (plan, status) => {
    set({ plan, status, isLoading: false });
  },

  setAdminMode: (enabled, adminPlan = "pro") => {
    set({
      adminMode: enabled,
      adminPlan,
      plan: enabled ? adminPlan : "free",
      status: enabled ? "active" : "inactive"
    });
  },

  fetchSubscription: async (clientId: string) => {
    const { adminMode, adminPlan } = get();

    // In admin mode, always return PRO
    if (adminMode) {
      set({
        plan: adminPlan,
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
  const { plan, status, adminMode, adminPlan } = useSubscriptionStore.getState();

  if (adminMode) {
    return adminPlan === "pro";
  }

  return plan === "pro" && status === "active";
};

export const canAccessReward = (cost: number) => {
  const { adminMode } = useSubscriptionStore.getState();

  // In admin mode, all rewards are accessible regardless of cost
  if (adminMode) {
    return true;
  }

  // Regular logic would check subscription + points here
  return hasProAccess() || cost <= 100; // Example threshold
};