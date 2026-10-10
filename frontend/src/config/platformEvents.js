import { Ban, Building2, CheckCircle2, KeyRound, LogIn, PencilLine, PlayCircle, ShieldAlert, ShieldCheck, UserCheck, UserPlus } from 'lucide-react';

// How each platform event reads in the console's activity feeds.
export const PLATFORM_EVENTS = {
  ORGANIZATION_SIGNED_UP: { label: 'Organisation registered', icon: Building2, tone: 'brand' },
  ORGANIZATION_SUSPENDED: { label: 'Organisation suspended', icon: Ban, tone: 'danger' },
  ORGANIZATION_REACTIVATED: { label: 'Organisation reactivated', icon: PlayCircle, tone: 'success' },
  ORGANIZATION_PROFILE_UPDATED: { label: 'Profile updated', icon: PencilLine, tone: 'neutral' },
  SIGNED_IN: { label: 'Signed in', icon: LogIn, tone: 'success' },
  SIGN_IN_FAILED: { label: 'Failed sign-in', icon: ShieldAlert, tone: 'danger' },
  USER_INVITED: { label: 'Staff invited', icon: UserPlus, tone: 'info' },
  ACCOUNT_SETUP_REQUESTED: { label: 'Setup code sent', icon: KeyRound, tone: 'neutral' },
  ACCOUNT_ACTIVATED: { label: 'Account activated', icon: UserCheck, tone: 'success' },
  PASSWORD_RESET_REQUESTED: { label: 'Reset code sent', icon: KeyRound, tone: 'warning' },
  PASSWORD_RESET_COMPLETED: { label: 'Password reset', icon: CheckCircle2, tone: 'info' },
  PLATFORM_ADMIN_SIGNED_IN: { label: 'Admin signed in', icon: ShieldCheck, tone: 'purple' },
};

export const describeEvent = (type) => PLATFORM_EVENTS[type] ?? { label: type, icon: CheckCircle2, tone: 'neutral' };
