import { useState } from "react";
import { usePointsStore } from "../../state/pointsStore";
import { useSubscriptionStore, type SubscriptionPlan } from "../../state/subscriptionStore";

export default function TestingPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [pointsToAdd, setPointsToAdd] = useState(1000);

  const points = usePointsStore((s) => s.points);
  const award = usePointsStore((s) => s.award);

  const { testingMode, testPlan, setTestingMode } = useSubscriptionStore();

  // Only show in development or when VITE_TESTER_MODE is true
  if (import.meta.env.VITE_TESTER_MODE !== "true") {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-50 bg-yellow-500 text-black px-3 py-1 rounded text-xs font-bold hover:bg-yellow-400"
        title="Testing Panel"
      >
        🧪 TEST
      </button>
    );
  }

  const handleAddPoints = () => {
    award(pointsToAdd, "Testing points added");
  };

  const handleSetPlan = (plan: SubscriptionPlan) => {
    setTestingMode(true, plan);
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/90 border border-yellow-500 rounded-lg p-4 min-w-[300px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-yellow-400 font-bold text-sm">🧪 TESTING PANEL</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white text-sm"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Points Management */}
        <div className="space-y-2">
          <div className="text-white text-xs font-semibold">
            Points: <span className="text-green-400">{points.toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={pointsToAdd}
              onChange={(e) => setPointsToAdd(Number(e.target.value))}
              className="bg-gray-800 text-white px-2 py-1 rounded text-xs w-20"
              min="1"
            />
            <button
              onClick={handleAddPoints}
              className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-500"
            >
              Add Points
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => award(500, "Quick 500")}
              className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-500 flex-1"
            >
              +500
            </button>
            <button
              onClick={() => award(2000, "Quick 2K")}
              className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-500 flex-1"
            >
              +2K
            </button>
            <button
              onClick={() => award(10000, "Max points")}
              className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-500 flex-1"
            >
              +10K
            </button>
          </div>
        </div>

        {/* Subscription Management */}
        <div className="space-y-2">
          <div className="text-white text-xs font-semibold">
            Plan: <span className={testPlan === "pro" ? "text-yellow-400" : "text-gray-400"}>
              {testPlan.toUpperCase()}
            </span>
            {testingMode && <span className="text-green-400 ml-1">(TEST)</span>}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleSetPlan("free")}
              className={`px-2 py-1 rounded text-xs flex-1 ${
                testPlan === "free" && testingMode
                  ? "bg-gray-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              FREE
            </button>
            <button
              onClick={() => handleSetPlan("pro")}
              className={`px-2 py-1 rounded text-xs flex-1 ${
                testPlan === "pro" && testingMode
                  ? "bg-yellow-600 text-white"
                  : "bg-yellow-800 text-yellow-300 hover:bg-yellow-700"
              }`}
            >
              PRO
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <div className="text-white text-xs font-semibold">Quick Actions</div>
          <button
            onClick={() => {
              award(10000, "Test max points");
              setTestingMode(true, "pro");
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-2 rounded text-xs font-bold hover:from-purple-500 hover:to-pink-500"
          >
            🚀 UNLOCK EVERYTHING
          </button>
        </div>

        <div className="text-yellow-400 text-xs">
          ⚠️ Testing mode only. Not visible in production.
        </div>
      </div>
    </div>
  );
}