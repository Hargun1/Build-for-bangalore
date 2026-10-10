// Rule-based vital-sign checks. Deterministic on purpose: emergency detection must not
// depend on an AI provider being up. Thresholds follow common early-warning ranges
// (e.g. NEWS2) and are screening flags, not diagnoses.

const EMERGENCY_TYPES = {
  HEART_ATTACK: {
    type: 'Possible cardiac emergency',
    icon: '💔',
    severity: 'emergency',
    color: '#ef5350',
  },
  CARDIAC_ARREST: {
    type: 'Cardiac Arrest',
    icon: '🫀',
    severity: 'emergency',
    color: '#d32f2f',
  },
  FAINTING: {
    type: 'Fainting / Syncope',
    icon: '😵',
    severity: 'pre-emergency',
    color: '#ffa726',
  },
  HEAT_STROKE: {
    type: 'Heat Stroke',
    icon: '🔥',
    severity: 'emergency',
    color: '#ff7043',
  },
  SEVERE_HYPOTENSION: {
    type: 'Severe Hypotension',
    icon: '📉',
    severity: 'emergency',
    color: '#ec407a',
  },
  RESPIRATORY_DISTRESS: {
    type: 'Respiratory Distress',
    icon: '🫁',
    severity: 'pre-emergency',
    color: '#42a5f5',
  },
  SEVERE_BRADYCARDIA: {
    type: 'Severe Bradycardia',
    icon: '🐢',
    severity: 'pre-emergency',
    color: '#ab47bc',
  },
};

// First aid instructions for each emergency type
export const FIRST_AID_GUIDES = {
  'Possible cardiac emergency': [
    { step: 1, icon: '📞', title: 'Call 112 / 108 now', desc: "Say \"possible heart attack\", the person's age, and where you are. Do not let them drive themselves.", timer: null },
    { step: 2, icon: '🪑', title: 'Sit Upright', desc: 'Help the person sit up in a comfortable position, leaning slightly forward. This reduces heart workload.', timer: null },
    { step: 3, icon: '👔', title: 'Loosen Clothing', desc: 'Loosen belt, tie, collar — anything tight. Ensure clear airway and easy breathing.', timer: null },
    { step: 4, icon: '💊', title: 'Aspirin only if advised', desc: 'If the 108 dispatcher or a doctor advises it and the person is not allergic, they can chew one 325 mg aspirin.', timer: null },
    { step: 5, icon: '🧘', title: 'Stay Calm & Monitor', desc: 'Keep the person calm and still. Monitor breathing and consciousness. Be ready to start CPR if they become unresponsive.', timer: null },
    { step: 6, icon: '🫀', title: 'CPR if Unresponsive', desc: 'If they stop breathing or go unconscious: 30 chest compressions, 2 rescue breaths. Push hard and fast (100-120/min).', timer: '2 min cycles' },
  ],
  'Cardiac Arrest': [
    { step: 1, icon: '📢', title: 'Call for Help', desc: 'Shout for help immediately. Call 112 or ask someone nearby to call while you begin CPR.', timer: null },
    { step: 2, icon: '✋', title: 'Check Responsiveness', desc: 'Tap shoulders firmly and shout. If no response and no normal breathing, begin CPR immediately.', timer: '10 sec max' },
    { step: 3, icon: '🫀', title: 'Start CPR — Compressions', desc: 'Place heel of hand on center of chest. Push hard (at least 2 inches deep) and fast (100-120 per minute). Let chest fully recoil.', timer: '30 compressions' },
    { step: 4, icon: '💨', title: 'Rescue Breaths', desc: 'Tilt head back, lift chin. Pinch nose, seal mouth. Give 2 breaths (1 second each). Watch for chest rise.', timer: '2 breaths' },
    { step: 5, icon: '🔄', title: 'Continue CPR Cycles', desc: 'Repeat: 30 compressions → 2 breaths. Do NOT stop until emergency services arrive or AED is available.', timer: '2 min cycles' },
    { step: 6, icon: '⚡', title: 'Use AED if Available', desc: 'Turn on AED, attach pads to bare chest. Follow voice prompts. Stand clear when it says "shock advised".', timer: null },
  ],
  'Fainting / Syncope': [
    { step: 1, icon: '🛏️', title: 'Lay Flat Immediately', desc: 'Help the person lie down on their back on a flat surface. If already unconscious, carefully lower them.', timer: null },
    { step: 2, icon: '🦵', title: 'Elevate Legs', desc: 'Raise their legs 12 inches above heart level. This helps blood flow back to the brain.', timer: null },
    { step: 3, icon: '👔', title: 'Loosen Tight Clothing', desc: 'Loosen belt, collar, or any restrictive clothing to improve circulation and breathing.', timer: null },
    { step: 4, icon: '🌬️', title: 'Ensure Fresh Air', desc: 'Move to a well-ventilated area. Fan the person gently. Avoid crowding around them.', timer: null },
    { step: 5, icon: '👁️', title: 'Check Breathing', desc: 'Monitor breathing and pulse. If not breathing normally, begin CPR. If breathing, place in recovery position.', timer: null },
    { step: 6, icon: '🚫', title: 'Do NOT Give Food/Water', desc: 'Do not give anything by mouth until fully conscious and alert. Risk of choking if semi-conscious.', timer: null },
  ],
  'Heat Stroke': [
    { step: 1, icon: '🏠', title: 'Move to Shade/AC', desc: 'Immediately move the person to a cool, shaded area or air-conditioned room.', timer: null },
    { step: 2, icon: '👕', title: 'Remove Excess Clothing', desc: 'Remove unnecessary clothing. Apply cool, damp cloths to skin or spray with cool water.', timer: null },
    { step: 3, icon: '🧊', title: 'Cool Rapidly', desc: 'Apply ice packs to neck, armpits, and groin area. These have blood vessels close to the skin.', timer: null },
    { step: 4, icon: '🌬️', title: 'Fan While Misting', desc: 'Mist with cool water while fanning. This accelerates evaporative cooling.', timer: null },
    { step: 5, icon: '💧', title: 'Hydrate if Conscious', desc: 'If conscious and alert, give cool water to drink in small sips. Do NOT force fluids.', timer: null },
    { step: 6, icon: '📞', title: 'Call 112 Immediately', desc: 'Heat stroke is life-threatening. Call emergency services even if person seems to recover.', timer: null },
  ],
  'Severe Hypotension': [
    { step: 1, icon: '🛏️', title: 'Lay Down Immediately', desc: 'Help the person lie flat. Elevate legs above heart level to improve blood flow to brain.', timer: null },
    { step: 2, icon: '💧', title: 'Hydrate', desc: 'If conscious, give water or oral rehydration solution to drink slowly.', timer: null },
    { step: 3, icon: '🧂', title: 'Salt Intake', desc: 'A small amount of salt (in water or food) can help raise blood pressure quickly.', timer: null },
    { step: 4, icon: '👁️', title: 'Monitor Consciousness', desc: 'Watch for signs of shock: pale skin, rapid breathing, confusion. Keep talking to them.', timer: null },
    { step: 5, icon: '🔄', title: 'Recovery Position', desc: 'If they become unconscious but breathing, place in recovery position (on their side).', timer: null },
    { step: 6, icon: '📞', title: 'Call Emergency Services', desc: 'If BP remains critically low or person loses consciousness, call 112 immediately.', timer: null },
  ],
  'Respiratory Distress': [
    { step: 1, icon: '🪑', title: 'Sit Upright', desc: 'Help the person sit upright, leaning slightly forward with hands on knees. This opens airways.', timer: null },
    { step: 2, icon: '🌬️', title: 'Pursed Lip Breathing', desc: 'Guide them: breathe in through nose (2 sec), out through pursed lips (4 sec). Slows breathing rate.', timer: '4-6 cycles' },
    { step: 3, icon: '💨', title: 'Use Inhaler if Available', desc: 'If they have a rescue inhaler (albuterol), help them use it: 2 puffs, wait 1 minute between puffs.', timer: null },
    { step: 4, icon: '🚪', title: 'Fresh Air', desc: 'Move away from triggers (smoke, allergens). Open windows or move outside for fresh air.', timer: null },
    { step: 5, icon: '👔', title: 'Loosen Clothing', desc: 'Ensure nothing is restricting chest movement. Remove belts, tight shirts, ties.', timer: null },
    { step: 6, icon: '📞', title: 'Call 112 if Not Improving', desc: 'If breathing doesn\'t improve in 5-10 minutes or worsens, call emergency services.', timer: null },
  ],
  'Severe Bradycardia': [
    { step: 1, icon: '🛏️', title: 'Lay Down Safely', desc: 'Help the person lie down to prevent falls from dizziness. Elevate legs slightly.', timer: null },
    { step: 2, icon: '👁️', title: 'Monitor Alertness', desc: 'Keep talking to them. Watch for signs of decreased consciousness, confusion, or fainting.', timer: null },
    { step: 3, icon: '🫀', title: 'Check Pulse Regularly', desc: 'Monitor pulse at wrist or neck. Count beats for 15 seconds, multiply by 4 for bpm.', timer: '15 sec' },
    { step: 4, icon: '📞', title: 'Call Emergency Services', desc: 'If heart rate stays below 40 bpm or person shows distress, call 112 immediately.', timer: null },
    { step: 5, icon: '🧘', title: 'Keep Calm & Warm', desc: 'Keep the person calm and warm. Anxiety can worsen the condition. Cover with a blanket.', timer: null },
    { step: 6, icon: '🫀', title: 'Be Ready for CPR', desc: 'If heartbeat stops or person becomes unresponsive, begin CPR immediately.', timer: null },
  ],
};

const has = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Checks the latest vitals against fixed thresholds. Missing readings are skipped,
 * never treated as zero. Returns null when nothing is out of range.
 * @param {{heartRate?: number, spo2?: number, bloodPressure?: {systolic: number, diastolic: number}, temperature?: number}} vitals
 */
export function detectEmergency(vitals) {
  const { heartRate: hr, spo2, temperature: temp } = vitals || {};
  const sys = vitals?.bloodPressure?.systolic;
  const dia = vitals?.bloodPressure?.diastolic;
  const bp = has(sys) ? `${sys}/${dia ?? "?"} mmHg` : "not measured";

  if (has(hr) && hr <= 15) {
    return { ...EMERGENCY_TYPES.CARDIAC_ARREST, rule: "heart rate at or below 15 bpm", details: `Heart rate ${hr} bpm` };
  }
  if (has(hr) && ((hr > 160 && has(sys) && sys > 170) || (hr > 150 && has(spo2) && spo2 < 90))) {
    return { ...EMERGENCY_TYPES.HEART_ATTACK, rule: "heart rate over 150-160 with very high BP or low oxygen", details: `HR ${hr} bpm, BP ${bp}, SpO₂ ${spo2 ?? "?"}%` };
  }
  if (has(sys) && (sys < 70 || (sys < 80 && has(dia) && dia < 50))) {
    return { ...EMERGENCY_TYPES.SEVERE_HYPOTENSION, rule: "systolic BP under 70 (or under 80 with diastolic under 50)", details: `BP ${bp}` };
  }
  if (has(temp) && temp > 40 && has(hr) && hr > 100) {
    return { ...EMERGENCY_TYPES.HEAT_STROKE, rule: "temperature over 40°C with heart rate over 100", details: `Temperature ${temp.toFixed(1)}°C, HR ${hr} bpm` };
  }
  if (has(spo2) && spo2 < 85) {
    return { ...EMERGENCY_TYPES.RESPIRATORY_DISTRESS, severity: "emergency", rule: "SpO₂ under 85%", details: `SpO₂ ${spo2}%` };
  }

  // Warnings: worth acting on, not an automatic SOS.
  if (has(spo2) && spo2 < 90 && has(sys) && sys < 90) {
    return { ...EMERGENCY_TYPES.FAINTING, rule: "SpO₂ under 90% with systolic BP under 90", details: `SpO₂ ${spo2}%, BP ${bp}` };
  }
  if (has(hr) && hr < 40) {
    return { ...EMERGENCY_TYPES.SEVERE_BRADYCARDIA, rule: "heart rate under 40 bpm", details: `Heart rate ${hr} bpm` };
  }
  if ((has(hr) && hr > 140) || (has(sys) && sys > 180)) {
    return { ...EMERGENCY_TYPES.HEART_ATTACK, severity: "pre-emergency", rule: "heart rate over 140 at rest or systolic BP over 180", details: `HR ${hr ?? "?"} bpm, BP ${bp}` };
  }
  if (has(spo2) && spo2 < 92) {
    return { ...EMERGENCY_TYPES.RESPIRATORY_DISTRESS, rule: "SpO₂ under 92%", details: `SpO₂ ${spo2}%` };
  }
  if (has(temp) && temp > 38.5) {
    return { ...EMERGENCY_TYPES.HEAT_STROKE, severity: "pre-emergency", rule: "temperature over 38.5°C", details: `Temperature ${temp.toFixed(1)}°C` };
  }
  return null;
}

export { EMERGENCY_TYPES };
