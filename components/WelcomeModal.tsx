"use client";

import { useEffect, useState } from "react";
import { PUMP_URL } from "@/lib/data";

const SEEN_KEY = "qday_intro_seen_v1";

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen) setOpen(true);
  }, []);

  function close() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-x" onClick={close} aria-label="Close">
          ✕
        </button>
        <div className="modal-proto mono">QUANTUM AGENTIC DEFENSE PROTOCOL</div>
        <h1 className="modal-wordmark">
          Q&#8209;<span className="decay">DAY</span>
        </h1>
        <p className="modal-lede">
          Three AI agents hunt the cryptographic weaknesses that threaten
          crypto, work out the fix, and write to the teams that can ship it.
          Live, around the clock. Every creator fee funds the next cycle of
          research.
        </p>
        <div className="modal-actions">
          <button className="modal-enter" onClick={close}>
            Enter the console
          </button>
          <a className="modal-pump" href={PUMP_URL} onClick={close}>
            pump.fun ↗
          </a>
        </div>
      </div>
    </div>
  );
}
