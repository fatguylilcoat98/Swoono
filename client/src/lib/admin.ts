// Admin access configuration
// Add your email and your testers' emails here
const ADMIN_EMAILS = [
  "stangman9898@gmail.com", // Chris Hughes (owner)
  // Add your testers' emails here:
  // "tester1@example.com",
  // "tester2@example.com",
];

/**
 * Check if the current user is an admin
 * Replaces the old tester mode system with proper admin access
 */
export const isAdmin = (): boolean => {
  const userEmail = getCurrentUserEmail();
  if (!userEmail) return false;

  return ADMIN_EMAILS.includes(userEmail.toLowerCase());
};

/**
 * Get the current user's email from Supabase session
 */
function getCurrentUserEmail(): string | null {
  try {
    // Get from Supabase session if available
    const session = window.localStorage.getItem('sb-swoono-auth-token');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed?.user?.email || null;
    }

    // Fallback to cached email method
    const cached = window.localStorage.getItem('swoono-cached-user-email');
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn('Error getting user email:', error);
    return null;
  }
}

/**
 * Admin debugging function
 */
export const logAdminStatus = (): void => {
  const email = getCurrentUserEmail();
  const adminStatus = isAdmin();
  console.log('🔧 Admin Status:', { email, isAdmin: adminStatus });
};

// Development helper - expose admin functions to window for debugging
if (import.meta.env.DEV) {
  (window as any).swoonoAdmin = {
    isAdmin,
    getCurrentUserEmail,
    logAdminStatus,
    ADMIN_EMAILS,
  };
  console.log('🔧 Admin functions available at window.swoonoAdmin');
}