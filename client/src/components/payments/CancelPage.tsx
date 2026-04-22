import { motion } from 'framer-motion';

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-6xl mb-6"
        >
          😔
        </motion.div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Subscription Cancelled
        </h1>

        <p className="text-gray-300 text-lg mb-8">
          No worries! You can always upgrade to PRO later when you're ready.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => window.history.back()}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            Try Again
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            Return to Swoono
          </button>
        </div>

        <p className="text-gray-400 text-sm mt-6">
          You can still enjoy all free features and earn points to unlock rewards!
        </p>
      </motion.div>
    </div>
  );
}