const KEY = "siapujian_token";

// Token is kept in localStorage too so an installed app can reopen the exam after being closed.
export const studentSession = {
  get: () => (typeof window === "undefined" ? null : sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY)),
  set: (t: string) => { sessionStorage.setItem(KEY, t); localStorage.setItem(KEY, t); },
  clear: () => { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); },
};

export const backupKey = (token: string) => `siapujian_backup_${token.slice(0, 16)}`;
export const examCacheKey = (token: string) => `siapujian_exam_${token.slice(0, 16)}`;
export const pendingSubmitKey = (token: string) => `siapujian_submit_${token.slice(0, 16)}`;
export const exitLockKey = (token: string) => `siapujian_exit_${token.slice(0, 16)}`;
export const activeExamKey = (token: string) => `siapujian_active_${token.slice(0, 16)}`;

export function clearExamCache(token: string) {
  localStorage.removeItem(backupKey(token));
  localStorage.removeItem(examCacheKey(token));
  localStorage.removeItem(pendingSubmitKey(token));
  localStorage.removeItem(exitLockKey(token));
  localStorage.removeItem(activeExamKey(token));
}
