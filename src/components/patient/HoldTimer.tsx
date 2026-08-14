"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/messages";

/**
 * Hold timer with an audible cue.
 *
 * The cue matters more than it looks: a patient counting a five second hold while watching
 * their own hand is not watching the screen. The countdown is also announced politely for
 * screen reader users, and the beep is generated rather than loaded so it works offline.
 */
export function HoldTimer({ seconds, locale }: { seconds: number; locale: Locale }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  function beep(frequency: number) {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const context = new Ctor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.08;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.15);
      window.setTimeout(() => void context.close(), 300);
    } catch {
      // Audio is an enhancement. A device that refuses it still shows the countdown.
    }
  }

  function start() {
    if (timer.current) window.clearInterval(timer.current);
    setRemaining(seconds);
    beep(660);

    timer.current = window.setInterval(() => {
      setRemaining((value) => {
        if (value === null) return null;
        const next = value - 1;
        if (next <= 0) {
          if (timer.current) window.clearInterval(timer.current);
          beep(880);
          return 0;
        }
        return next;
      });
    }, 1000);
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        onClick={start}
        className="rounded-[--radius-control] border border-[--color-border-strong] bg-[--color-surface-sunken] px-4 py-2 text-base font-medium"
      >
        {locale === "ur" ? "ٹائمر" : "Timer"}
      </button>
      <output aria-live="polite" className="text-xl font-semibold tabular-nums">
        {remaining === null ? `${seconds}s` : remaining === 0 ? "0s" : `${remaining}s`}
      </output>
    </div>
  );
}
