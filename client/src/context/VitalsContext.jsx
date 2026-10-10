import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Where the live vitals come from:
 *   "bluetooth" - a real heart-rate monitor over Web Bluetooth (standard GATT Heart Rate
 *                 service 0x180D: chest straps, many watches in broadcast mode)
 *   "manual"    - numbers the user typed in (e.g. from a BP cuff or pulse oximeter)
 *   "simulator" - generated demo values, always labelled SIMULATED in the UI
 *   "none"      - nothing connected
 */
const VitalsContext = createContext(null);

const EMPTY = { heartRate: null, spo2: null, bloodPressure: null, temperature: null, hrvMs: null, timestamp: null };

// Demo scenarios for presentations. Values are random within a range each tick.
const r = (lo, hi) => lo + Math.random() * (hi - lo);
const SCENARIOS = {
  normal: () => ({ heartRate: r(66, 80), spo2: r(96, 99), bloodPressure: { systolic: r(112, 124), diastolic: r(72, 80) }, temperature: r(36.5, 36.9) }),
  "high-hr": () => ({ heartRate: r(165, 182), spo2: r(94, 97), bloodPressure: { systolic: r(150, 165), diastolic: r(95, 104) }, temperature: r(37.2, 37.6) }),
  "low-spo2": () => ({ heartRate: r(96, 110), spo2: r(82, 86), bloodPressure: { systolic: r(120, 130), diastolic: r(80, 88) }, temperature: r(36.6, 36.9) }),
  "cardiac-arrest": () => ({ heartRate: r(0, 10), spo2: r(70, 78), bloodPressure: { systolic: 60, diastolic: 30 }, temperature: r(35.5, 36) }),
  fainting: () => ({ heartRate: r(44, 52), spo2: r(87, 90), bloodPressure: { systolic: r(78, 86), diastolic: 45 }, temperature: r(36.2, 36.5) }),
  "heat-stroke": () => ({ heartRate: r(115, 130), spo2: r(93, 96), bloodPressure: { systolic: r(100, 112), diastolic: r(60, 68) }, temperature: r(40.2, 40.9) }),
  hypotension: () => ({ heartRate: r(100, 112), spo2: r(94, 97), bloodPressure: { systolic: r(64, 69), diastolic: 38 }, temperature: r(36.4, 36.7) }),
};

/** Parses a Heart Rate Measurement characteristic value (Bluetooth SIG spec, 0x2A37). */
export function parseHeartRate(view) {
  const flags = view.getUint8(0);
  const is16Bit = flags & 0x01;
  let offset = 1;
  const heartRate = is16Bit ? view.getUint16(offset, true) : view.getUint8(offset);
  offset += is16Bit ? 2 : 1;
  if (flags & 0x08) offset += 2; // energy expended field present
  const rrIntervalsMs = [];
  if (flags & 0x10) {
    for (; offset + 1 < view.byteLength; offset += 2) {
      rrIntervalsMs.push((view.getUint16(offset, true) / 1024) * 1000); // units of 1/1024 s
    }
  }
  return { heartRate, rrIntervalsMs };
}

/** RMSSD: the standard short-term heart-rate-variability measure, from beat-to-beat intervals. */
export function rmssd(rr) {
  if (rr.length < 10) return null;
  let sum = 0;
  for (let i = 1; i < rr.length; i += 1) sum += (rr[i] - rr[i - 1]) ** 2;
  return Math.round(Math.sqrt(sum / (rr.length - 1)));
}

export function VitalsProvider({ children }) {
  const [source, setSource] = useState("none");
  const [vitals, setVitals] = useState(EMPTY);
  const [history, setHistory] = useState([]); // [{ t, hr }]
  const [device, setDevice] = useState(null); // { name }
  const [status, setStatus] = useState({ connecting: false, error: "" });
  const [scenario, setScenario] = useState("normal");
  const btRef = useRef({ device: null, characteristic: null, rr: [] });
  const simRef = useRef(null);

  const bluetoothSupported = typeof navigator !== "undefined" && Boolean(navigator.bluetooth);

  const pushHr = useCallback((hr) => {
    setHistory((h) => [...h, { t: Date.now(), hr }].slice(-180));
  }, []);

  const stopSimulator = useCallback(() => {
    if (simRef.current) clearInterval(simRef.current);
    simRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    stopSimulator();
    const bt = btRef.current;
    try {
      bt.characteristic?.removeEventListener("characteristicvaluechanged", bt.onValue);
      if (bt.device?.gatt?.connected) bt.device.gatt.disconnect();
    } catch {
      /* already gone */
    }
    btRef.current = { device: null, characteristic: null, rr: [] };
    setDevice(null);
    setSource("none");
    setVitals(EMPTY);
    setHistory([]);
  }, [stopSimulator]);

  const connectBluetooth = useCallback(async () => {
    if (!bluetoothSupported) {
      setStatus({ connecting: false, error: "This browser can't use Bluetooth. Use Chrome or Edge on Android, Windows or macOS." });
      return;
    }
    disconnect();
    setStatus({ connecting: true, error: "" });
    try {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }], optionalServices: ["battery_service"] });
      const server = await dev.gatt.connect();
      const service = await server.getPrimaryService("heart_rate");
      const characteristic = await service.getCharacteristic("heart_rate_measurement");
      const onValue = (event) => {
        const { heartRate, rrIntervalsMs } = parseHeartRate(event.target.value);
        const bt = btRef.current;
        bt.rr = [...bt.rr, ...rrIntervalsMs].slice(-120);
        setVitals((v) => ({ ...v, heartRate, hrvMs: rmssd(bt.rr), timestamp: Date.now() }));
        pushHr(heartRate);
      };
      characteristic.addEventListener("characteristicvaluechanged", onValue);
      await characteristic.startNotifications();
      dev.addEventListener("gattserverdisconnected", () => {
        setStatus({ connecting: false, error: `${dev.name || "The device"} disconnected.` });
        setSource("none");
        setDevice(null);
      });
      btRef.current = { device: dev, characteristic, rr: [], onValue };
      setDevice({ name: dev.name || "Heart-rate monitor" });
      setSource("bluetooth");
      setStatus({ connecting: false, error: "" });
    } catch (err) {
      const cancelled = err?.name === "NotFoundError";
      setStatus({ connecting: false, error: cancelled ? "" : `Couldn't connect: ${err?.message || "unknown error"}. Make sure the device is on, nearby and not paired to another app.` });
    }
  }, [bluetoothSupported, disconnect, pushHr]);

  const setManualVitals = useCallback(
    (values) => {
      stopSimulator();
      setSource("manual");
      setVitals((v) => ({ ...(v.timestamp && source === "manual" ? v : EMPTY), ...values, timestamp: Date.now() }));
      if (values.heartRate) pushHr(values.heartRate);
    },
    [pushHr, stopSimulator, source]
  );

  const startSimulator = useCallback(
    (name = "normal") => {
      disconnect();
      setScenario(name);
      setSource("simulator");
      const tick = () => {
        const v = SCENARIOS[name]();
        const rounded = {
          heartRate: Math.round(v.heartRate),
          spo2: Math.round(v.spo2),
          bloodPressure: { systolic: Math.round(v.bloodPressure.systolic), diastolic: Math.round(v.bloodPressure.diastolic) },
          temperature: Math.round(v.temperature * 10) / 10,
          hrvMs: null,
          timestamp: Date.now(),
        };
        setVitals(rounded);
        pushHr(rounded.heartRate);
      };
      tick();
      simRef.current = setInterval(tick, 2000);
    },
    [disconnect, pushHr]
  );

  useEffect(() => () => disconnect(), [disconnect]);

  const value = useMemo(
    () => ({
      source,
      vitals,
      history,
      device,
      status,
      scenario,
      scenarios: Object.keys(SCENARIOS),
      bluetoothSupported,
      isSimulated: source === "simulator",
      hasData: source !== "none" && vitals.timestamp != null,
      connectBluetooth,
      setManualVitals,
      startSimulator,
      disconnect,
    }),
    [source, vitals, history, device, status, scenario, bluetoothSupported, connectBluetooth, setManualVitals, startSimulator, disconnect]
  );

  return <VitalsContext.Provider value={value}>{children}</VitalsContext.Provider>;
}

export function useVitals() {
  const ctx = useContext(VitalsContext);
  if (!ctx) throw new Error("useVitals must be used inside VitalsProvider");
  return ctx;
}
