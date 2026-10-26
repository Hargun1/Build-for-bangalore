import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SOSButton({ onTrigger, onCancel, isActive, emergencyType }) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const holdTimer = useRef(null);
  const countdownTimer = useRef(null);
  const startTime = useRef(null);
  const HOLD_DURATION = 2000; // 2 seconds to trigger
  const COUNTDOWN_SECONDS = 5; // 5 second countdown before full activation

  const circumference = 2 * Math.PI * 108; // ring radius

  const startHold = useCallback(() => {
    if (countdown !== null || holdTimer.current) return; // already in countdown
    setHolding(true);
    startTime.current = Date.now();

    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const pct = Math.min(elapsed / HOLD_DURATION, 1);
      setProgress(pct);

      if (pct >= 1) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
        setHolding(false);
        setProgress(0);
        startCountdown();
      }
    }, 30);
  }, [countdown]);

  const endHold = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
    setProgress(0);
  }, []);

  const startCountdown = () => {
    let seconds = COUNTDOWN_SECONDS;
    setCountdown(seconds);

    countdownTimer.current = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);

      if (seconds <= 0) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        setCountdown(null);
        // Trigger emergency!
        if (onTrigger) onTrigger();
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setCountdown(null);
    if (onCancel) onCancel();
  };

  // Auto-trigger if emergency detected externally
  useEffect(() => {
    if (isActive && countdown === null) {
      startCountdown();
    }
  }, [isActive]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearInterval(holdTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  const dashOffset = circumference - (progress * circumference);

  return (
    <div className="sos-section">
      <AnimatePresence mode="wait">
        {countdown !== null ? (
          <motion.div
            key="countdown"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{ textAlign: 'center' }}
          >
            <div className="sos-countdown">{countdown}</div>
            <p style={{ color: 'var(--ui-bad)', fontSize: '1rem', fontWeight: 600, marginTop: '0.5rem' }}>
              Emergency activating in {countdown} seconds...
            </p>
            {emergencyType && (
              <p style={{ color: 'var(--ui-warn)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Detected: {emergencyType}
              </p>
            )}
            <button className="sos-cancel-btn" onClick={cancelCountdown}>
              Cancel emergency
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <div className="sos-button-wrap">
              {/* Progress Ring */}
              <svg
                className="sos-progress-ring"
                width="216"
                height="216"
                viewBox="0 0 216 216"
              >
                <circle className="ring-bg" cx="108" cy="108" r="108" />
                <circle
                  className="ring-fill"
                  cx="108"
                  cy="108"
                  r="108"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: dashOffset,
                    transform: 'rotate(-90deg)',
                    transformOrigin: 'center',
                  }}
                />
              </svg>

              {/* SOS Button */}
              <motion.button
                className="sos-button"
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onBlur={endHold}
                onKeyDown={(e) => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); if (!e.repeat) startHold(); } }}
                onKeyUp={(e) => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); endHold(); } }}
                aria-label="Hold for two seconds to start emergency SOS"
                aria-pressed={holding}
              >
                SOS
                <span className="sos-button-sub">HOLD TO TRIGGER</span>
              </motion.button>
            </div>
            <p className="sos-label">Press and hold for 2 seconds to trigger emergency SOS</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
