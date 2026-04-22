import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { isAdmin, logAdminStatus } from "../../lib/admin";
import { useSubscriptionStore } from "../../state/subscriptionStore";

export default function AdminPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const adminAccess = isAdmin();
  const { adminMode, adminPlan, setAdminMode } = useSubscriptionStore();

  // Only show for admin users
  if (!adminAccess) {
    return null;
  }

  const handleToggleAdminMode = (plan: "free" | "pro") => {
    if (adminMode && adminPlan === plan) {
      // Turn off admin mode
      setAdminMode(false);
    } else {
      // Turn on admin mode with selected plan
      setAdminMode(true, plan);
    }
  };

  const debugInfo = {
    adminAccess,
    adminMode,
    adminPlan,
    currentUrl: window.location.href,
    userAgent: navigator.userAgent.split(' ')[0] + '...',
    timestamp: new Date().toLocaleString(),
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 bg-yellow-500 hover:bg-yellow-400 text-black rounded-full w-12 h-12 flex items-center justify-center font-bold shadow-lg transition-all"
        title="Admin Panel"
      >
        ⚙️
      </button>

      {/* Admin Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-4 right-4 bottom-4 w-80 bg-black/90 backdrop-blur border border-yellow-400/30 rounded-xl p-4 z-40 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔧</span>
                <h3 className="font-bold text-yellow-400">Admin Panel</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Display */}
              <div className="bg-white/5 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-white mb-2">Status</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/70">Admin Access:</span>
                    <span className="text-green-400">✓ Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Admin Mode:</span>
                    <span className={adminMode ? "text-green-400" : "text-white/50"}>
                      {adminMode ? `✓ ${adminPlan.toUpperCase()}` : "○ Disabled"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Mode Controls */}
              <div className="bg-white/5 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-white mb-3">Admin Mode</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => handleToggleAdminMode("free")}
                    className={`w-full py-2 px-3 rounded text-xs font-semibold transition-colors ${
                      adminMode && adminPlan === "free"
                        ? "bg-blue-500 text-white"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {adminMode && adminPlan === "free" ? "✓" : "○"} Test as FREE User
                  </button>
                  <button
                    onClick={() => handleToggleAdminMode("pro")}
                    className={`w-full py-2 px-3 rounded text-xs font-semibold transition-colors ${
                      adminMode && adminPlan === "pro"
                        ? "bg-purple-500 text-white"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {adminMode && adminPlan === "pro" ? "✓" : "○"} Test as PRO User
                  </button>
                  <button
                    onClick={() => setAdminMode(false)}
                    disabled={!adminMode}
                    className="w-full py-2 px-3 rounded text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Disable Admin Mode
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white/5 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-white mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      logAdminStatus();
                      console.log("🔧 Admin panel state:", debugInfo);
                    }}
                    className="w-full py-2 px-3 rounded text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/20"
                  >
                    Log Admin Status
                  </button>
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="w-full py-2 px-3 rounded text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/20"
                  >
                    {showDebug ? "Hide" : "Show"} Debug Info
                  </button>
                </div>
              </div>

              {/* Debug Information */}
              <AnimatePresence>
                {showDebug && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white/5 rounded-lg p-3 overflow-hidden"
                  >
                    <h4 className="text-sm font-semibold text-white mb-2">Debug Info</h4>
                    <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap">
                      {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-3">
                <p className="text-yellow-400 text-xs">
                  ⚠️ Admin panel only visible to authorized users. Use admin mode to test different subscription tiers without affecting real billing.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}