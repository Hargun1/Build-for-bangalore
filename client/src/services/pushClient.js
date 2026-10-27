import api from "./api";

/** Browser side of Web Push: register the service worker and subscribe this device. */

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// iPhones only allow web push for sites added to the Home Screen (iOS 16.4+).
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) || navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** "unsupported" | "denied" | "off" | "on" for this device. */
export async function devicePushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush() {
  const { data: status } = await api.get("/reminders/push/status");
  if (!status.configured) throw new Error("Notifications aren't set up on the server yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked. Allow them in your browser's site settings." : "Notifications weren't allowed.");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const key = urlBase64ToUint8Array(status.publicKey);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an old server key can't receive messages: replace it.
  const oldKey = sub?.options?.applicationServerKey && new Uint8Array(sub.options.applicationServerKey);
  if (sub && oldKey && (oldKey.length !== key.length || oldKey.some((b, i) => b !== key[i]))) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.post("/reminders/push/subscribe", sub.toJSON());
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await api.post("/reminders/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export const sendTestPush = () => api.post("/reminders/push/test");
export const getReminders = () => api.get("/reminders");
export const createReminder = (r) => api.post("/reminders", r);
export const updateReminder = (id, r) => api.put(`/reminders/${id}`, r);
export const deleteReminder = (id) => api.delete(`/reminders/${id}`);
export async function downloadReminderCalendar() {
  const { data } = await api.get("/reminders/calendar.ics", { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pranexus-reminders.ics";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
