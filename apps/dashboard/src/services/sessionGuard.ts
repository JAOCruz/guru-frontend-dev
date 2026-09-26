// The backend answers USER_INACTIVE once an admin deactivates the account:
// drop the stored session and send the person to login with an explanation.
export function handleInactiveSession(
  error: any,
  redirect: (url: string) => void = (url) => window.location.assign(url),
  currentPath: string = window.location.pathname,
): boolean {
  if (error?.response?.data?.code !== "USER_INACTIVE") return false;
  localStorage.removeItem("token");
  localStorage.removeItem("rememberMe");
  sessionStorage.removeItem("token");
  if (!currentPath.startsWith("/login")) redirect("/login?inactive=1");
  return true;
}

let reloadRequested = false;

// An admin set a temporary password while this session was open: every API call
// now answers PASSWORD_CHANGE_REQUIRED. Reload once so /auth/me reports
// mustChangePassword and ProtectedRoute shows "Crea tu contraseña".
export function handlePasswordChangeRequired(
  error: any,
  reload: () => void = () => window.location.reload(),
): boolean {
  if (error?.response?.data?.code !== "PASSWORD_CHANGE_REQUIRED") return false;
  if (!reloadRequested) {
    reloadRequested = true;
    reload();
  }
  return true;
}

export function resetSessionGuard() {
  reloadRequested = false;
}
