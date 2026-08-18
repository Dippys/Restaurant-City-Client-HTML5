/**
 * Backend session helpers (M2 login flow).
 *
 * The backend authenticates via its session cookie and exposes
 * GET /__api/session -> { ok, loggedIn, account, csrfToken }. The backend's
 * own login pages redirect back to `next` — so the client just needs to
 * send unauthenticated users to /login?next=<current path>.
 */

export interface SessionAccount {
  username?: string;
  displayName?: string;
  admin?: boolean;
  [key: string]: unknown;
}

export interface SessionInfo {
  loggedIn: boolean;
  account: SessionAccount | null;
}

export async function fetchSession(): Promise<SessionInfo> {
  const response = await fetch('/__api/session', { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`session API HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    ok?: boolean;
    loggedIn?: boolean;
    account?: SessionAccount | null;
  };
  return {
    loggedIn: data.loggedIn === true,
    account: data.account ?? null,
  };
}

/**
 * Sends the user to the backend login page when unauthenticated.
 * Returns true when a session exists, false when a redirect happened.
 */
export async function requireSession(redirectPath = '/'): Promise<boolean> {
  const session = await fetchSession();
  if (session.loggedIn) {
    return true;
  }
  window.location.assign(`/login?next=${encodeURIComponent(redirectPath)}`);
  return false;
}
