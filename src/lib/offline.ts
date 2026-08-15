/** Browser online flag — used to fail-open the desk when the phone has no data. */
export function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
