import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

const POLL_MS = 25000;

/** ריענון הזמנות/בריכת מובילים — push (ordersTick) + polling גיבוי */
export function useOrderLiveRefresh(refreshFn) {
  const tick = useSelector((s) => s.realtime?.ordersTick ?? 0);
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;

  useEffect(() => {
    if (tick > 0) fnRef.current?.();
  }, [tick]);

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") fnRef.current?.();
    };
    const interval = setInterval(run, POLL_MS);
    const onVisible = () => run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
