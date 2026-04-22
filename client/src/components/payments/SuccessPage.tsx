import { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function SuccessPage() {
  useEffect(() => {
    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="text-8xl mb-6"
        >
          ✅
        </motion.div>

        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to Swoono PRO!
        </h1>

        <p className="text-green-300 text-lg mb-8">
          Your subscription is now active. Enjoy unlimited access to all features!
        </p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-3 mb-8 text-left"
        >
          <div className="flex items-center gap-3 text-white">
            <span className="text-green-400">✨</span>
            <span>All Milestone rewards unlocked</span>
          </div>
          <div className="flex items-center gap-3 text-white">
            <span className="text-green-400">🎊</span>
            <span>All Legendary effects available</span>
          </div>
          <div className="flex items-center gap-3 text-white">
            <span className="text-green-400">👑</span>
            <span>PRO badge in your room</span>
          </div>
        </motion.div>

        <button
          onClick={() => window.location.href = '/'}
          className="bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-xl transition-colors"
        >
          Return to Swoono
        </button>

        <p className="text-green-300 text-sm mt-4">
          Redirecting automatically in 5 seconds...
        </p>
      </motion.div>
    </div>
  );
}