/**
 * Go back to the screen the user actually came from.
 *
 * Wouter pushes a history entry for every in-app setLocation, so
 * window.history.back() returns to the real previous screen no matter which
 * of a page's entry points was used. The fallback covers entries where there
 * is no in-app screen beneath this one (cold starts, deep links).
 *
 * "Is there an in-app screen beneath us?" can't be answered with
 * history.length — it counts the tab's whole session including cross-origin
 * pages (a same-tab deep link would have length > 1 and history.back() would
 * eject the user to the external referrer), and it never shrinks (after a
 * fallback push + pop round-trip, back() at index 0 is a silent no-op).
 * Instead we stamp every in-app pushState with a monotonically increasing
 * index and track our position via popstate: index 0 = the tab's first in-app
 * entry, so fall back; index > 0 = a real in-app entry exists beneath us.
 */

let navIndex: number =
  (typeof window !== "undefined" && (window.history.state?.__appNavIndex as number)) || 0;

if (typeof window !== "undefined") {
  const stamp = (state: unknown, index: number) => ({
    ...(typeof state === "object" && state !== null ? state : {}),
    __appNavIndex: index,
  });

  const origPush = window.history.pushState.bind(window.history);
  window.history.pushState = (state: unknown, title: string, url?: string | URL | null) => {
    navIndex += 1;
    return origPush(stamp(state, navIndex), title, url);
  };

  const origReplace = window.history.replaceState.bind(window.history);
  window.history.replaceState = (state: unknown, title: string, url?: string | URL | null) => {
    // replace keeps the entry's position — preserve the current index stamp
    return origReplace(stamp(state, navIndex), title, url);
  };

  window.addEventListener("popstate", (e) => {
    navIndex = (e.state?.__appNavIndex as number) || 0;
  });
}

export function goBack(setLocation: (to: string) => void, fallback: string) {
  if (navIndex > 0) {
    window.history.back();
  } else {
    setLocation(fallback);
  }
}
