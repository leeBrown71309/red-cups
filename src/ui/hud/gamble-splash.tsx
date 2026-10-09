import { useEffect, useState } from "react";
import { onFeedback } from "../../feedback/event-bus";

const SPLASH_MS = 2_000;

interface Splash {
  key: number;
  doubled: boolean;
}

/** Double or nothing: « Double » in green or « Nothing » in red, big in the middle of every screen. */
export function GambleSplash() {
  const [splash, setSplash] = useState<Splash | null>(null);

  useEffect(
    () =>
      onFeedback((event) => {
        if (event.type === "gamble-result")
          setSplash((current) => ({ key: (current?.key ?? 0) + 1, doubled: event.doubled }));
      }),
    [],
  );

  useEffect(() => {
    if (!splash) return undefined;
    const timer = window.setTimeout(() => setSplash(null), SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [splash]);

  if (!splash) return null;
  return (
    <div className="gamble-splash" key={splash.key} role="status" aria-live="assertive">
      <strong className={`gamble-splash__word ${splash.doubled ? "is-double" : "is-nothing"}`}>
        {splash.doubled ? "Double" : "Nothing"}
      </strong>
    </div>
  );
}
