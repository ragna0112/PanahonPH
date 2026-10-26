import { useEffect, useState } from "react";
const HOUR = 3_600_000;
export function useForecastClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(update, HOUR - (Date.now() % HOUR) + 50);
    };
    const update = () => {
      if (!document.hidden) setNow(Date.now());
      schedule();
    };
    const resume = () => {
      if (!document.hidden) update();
    };
    schedule();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, []);
  return now;
}
