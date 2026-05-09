import { useAuth } from './useAuth';

const ROLE_ORDER = { guest: 0, individual: 1, advisor: 2, admin: 3 };

export function useRole() {
  const { user, role, planTier, loading } = useAuth();
  const effectiveRole = user ? (role || 'individual') : 'guest';

  return {
    role:       effectiveRole,
    planTier:   planTier || 'free',
    loading,
    isGuest:      !user,
    isIndividual: effectiveRole === 'individual',
    isAdvisor:    effectiveRole === 'advisor',
    isAdmin:      effectiveRole === 'admin',
    hasRole: (required) =>
      (ROLE_ORDER[effectiveRole] ?? 0) >= (ROLE_ORDER[required] ?? 0),
  };
}
