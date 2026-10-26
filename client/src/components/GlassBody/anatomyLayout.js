// Front camera looks along -Z: the patient's left is +X, anterior is +Z.
// Coordinates are in metres relative to the centre of the 1.8 m reference skeleton.
// This is an educational reference layout, not a patient-specific anatomical scan.
export const ANATOMY = {
  brain: { name: "Brain", system: "Head & neck", position: [0, .79, -.005], size: .145, color: "#d9ada9", model: "human_brain.glb" },
  eyes: { name: "Eyes", system: "Head & neck", position: [0, .748, .085], color: "#c8d9cf" },
  thyroid: { name: "Thyroid", system: "Head & neck", position: [0, .61, .055], color: "#d9a17a" },
  lungs: { name: "Lungs", system: "Chest", position: [0, .445, .005], size: .36, color: "#cd9296", model: "realistic_human_lungs.glb" },
  heart: { name: "Heart", system: "Chest", position: [.035, .395, .075], size: .13, color: "#c75b61", model: "realistic_human_heart.glb" },
  liver: { name: "Liver", system: "Abdomen", position: [-.065, .265, .03], size: .235, color: "#a95d52", model: "human_liver_and_gallbladder.glb", part: "liver.001", rotation: [Math.PI / 2, Math.PI / 2, 0] },
  gallbladder: { name: "Gallbladder", system: "Abdomen", position: [-.065, .205, .058], color: "#92ad78" },
  stomach: { name: "Stomach", system: "Abdomen", position: [.075, .225, .07], color: "#d5a493" },
  spleen: { name: "Spleen", system: "Abdomen", position: [.145, .255, -.035], color: "#a56e8a" },
  pancreas: { name: "Pancreas", system: "Abdomen", position: [.025, .195, -.025], color: "#d5b16e" },
  kidneyL: { name: "Left kidney", system: "Urinary", position: [.105, .19, -.075], size: .108, color: "#b97063", model: "medicine_organ_-_the_human_kidney.glb" },
  kidneyR: { name: "Right kidney", system: "Urinary", position: [-.105, .175, -.075], size: .108, color: "#b97063", model: "medicine_organ_-_the_human_kidney.glb", rotation: [0, Math.PI, 0] },
  digestive: { name: "Intestines", system: "Abdomen", position: [0, .075, .04], color: "#d6a692" },
  bladder: { name: "Bladder", system: "Urinary", position: [0, -.065, .055], color: "#d9bd8f" },
  uterus: { name: "Uterus", system: "Pelvis", position: [0, -.042, -.005], color: "#c991a0", female: true },
  ovaryL: { name: "Left ovary", system: "Pelvis", position: [.065, -.015, .005], color: "#d9a8b4", female: true },
  ovaryR: { name: "Right ovary", system: "Pelvis", position: [-.065, -.015, .005], color: "#d9a8b4", female: true },
};

const SYSTEMS = ["Head & neck", "Chest", "Abdomen", "Urinary", "Pelvis"];
export const organKeys = (body) => Object.keys(ANATOMY).filter((key) => !ANATOMY[key].female || body === "female").sort((a, b) => SYSTEMS.indexOf(ANATOMY[a].system) - SYSTEMS.indexOf(ANATOMY[b].system));
export const riskTone = (score) => !Number.isFinite(score) ? "none" : score > .7 ? "bad" : score > .4 ? "warn" : "good";
export const RISK_COLORS = { none: "#a5b3ad", good: "#a6dfbf", warn: "#e8c17b", bad: "#ed9891" };
