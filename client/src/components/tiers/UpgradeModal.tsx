import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [isLoading, setIsLoading] = useState(false);

  const plans = {
    monthly: {
      name: "Monthly",
      price: "$4.99/mo",
      priceId: process.env.VITE_STRIPE_MONTHLY_PRICE_ID || "price_monthly",
      description: "Cancel anytime"
    },
    yearly: {
      name: "Yearly",
      price: "$39.99/yr",
      priceId: process.env.VITE_STRIPE_YEARLY_PRICE_ID || "price_yearly",
      description: "⭐ BEST VALUE",
      savings: "Yearly saves you $20"
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: 'test-client-id', // Replace with actual client ID
          roomCode: 'TEST', // Replace with actual room code
          priceId: plans[selectedPlan].priceId,
          email: 'user@example.com' // Replace with actual email
        })
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 rounded-2xl p-8 border border-pink-500/30 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-light"
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Upgrade to Swoono PRO 💖
              </h1>
              <p className="text-pink-300 text-lg">
                Skip the grind. Get everything now.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              {[
                "✨ All Milestone rewards (Proposal, Anniversary & more)",
                "🎊 All Legendary effects unlocked",
                "💌 Unlimited Care Packages",
                "🔥 All dare tiers (Medium + Spicy)",
                "👑 PRO badge in your room",
                "🎮 All games unlocked immediately",
                "⚡ First access to new features"
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-3 text-white">
                  <span className="text-sm leading-relaxed">{benefit}</span>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedPlan("monthly")}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedPlan === "monthly"
                      ? "border-pink-400 bg-pink-400/20"
                      : "border-gray-600 bg-gray-800/50 hover:border-gray-500"
                  }`}
                >
                  <div className="text-white text-center">
                    <div className="font-bold text-lg">{plans.monthly.name}</div>
                    <div className="text-2xl font-bold text-pink-400">{plans.monthly.price}</div>
                    <div className="text-xs text-gray-300">{plans.monthly.description}</div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedPlan("yearly")}
                  className={`p-4 rounded-xl border-2 transition-all relative ${
                    selectedPlan === "yearly"
                      ? "border-yellow-400 bg-yellow-400/20"
                      : "border-gray-600 bg-gray-800/50 hover:border-gray-500"
                  }`}
                >
                  <div className="text-white text-center">
                    <div className="font-bold text-lg">{plans.yearly.name}</div>
                    <div className="text-2xl font-bold text-yellow-400">{plans.yearly.price}</div>
                    <div className="text-xs text-yellow-300">{plans.yearly.description}</div>
                  </div>
                </button>
              </div>

              {selectedPlan === "yearly" && (
                <div className="text-center text-green-400 text-sm font-semibold">
                  {plans.yearly.savings}
                </div>
              )}
            </div>

            {/* Subscribe button */}
            <button
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:from-pink-400 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {isLoading ? "Processing..." : `Subscribe ${plans[selectedPlan].price}`}
            </button>

            <p className="text-center text-gray-400 text-xs mt-4">
              Secure checkout powered by Stripe. Cancel anytime.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}