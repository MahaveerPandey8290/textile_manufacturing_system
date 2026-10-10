// Remembers the organisation a device last signed in to, and how (`entry`: 'staff' with the code,
// or 'organization' for the admin "Welcome back" page), so the next visit starts on the right
// sign-in page with the organisation's logo and name. Only public branding is stored. Storage can be unavailable, so every
// access is guarded and the app works the same without it.
const STORAGE_KEY = 'millos.organization';

export function getRememberedOrganization() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    return stored?.code ? stored : null;
  } catch {
    return null;
  }
}

export function rememberOrganization(organization, entry) {
  try {
    const previous = getRememberedOrganization();
    const keptEntry = previous?.code === organization.code ? previous.entry : undefined;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...organization, entry: entry ?? keptEntry ?? 'staff' }));
  } catch {
    // Private mode or blocked storage: nothing to remember, nothing breaks.
  }
}

export function forgetOrganization() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
