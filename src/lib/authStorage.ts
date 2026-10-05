type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createAuthStorage(local: Store, session: Store, authKey: string) {
  const preferenceKey = `${authKey}:remember`;
  const remembers = () => {
    const choice = session.getItem(preferenceKey) ?? local.getItem(preferenceKey);
    // Preserve sessions saved before this option existed.
    return choice === "true" || (choice === null && local.getItem(authKey) !== null);
  };
  const destination = () => remembers() ? local : session;
  return {
    storage: {
      getItem(key: string) { return destination().getItem(key); },
      setItem(key: string, value: string) {
        const target = destination();
        target.setItem(key, value);
        (target === local ? session : local).removeItem(key);
      },
      removeItem(key: string) { local.removeItem(key); session.removeItem(key); },
    },
    setRemember(remember: boolean) {
      const old = destination();
      const value = String(remember);
      // Keep this tab's choice stable if another tab changes its preference.
      session.setItem(preferenceKey, value);
      local.setItem(preferenceKey, value);
      const target = destination();
      for (const key of [authKey, `${authKey}-code-verifier`, `${authKey}-user`]) {
        const stored = old.getItem(key);
        if (stored !== null) target.setItem(key, stored);
        (target === local ? session : local).removeItem(key);
      }
    },
  };
}
