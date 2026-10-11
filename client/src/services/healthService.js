import api from "./api";

// One place for every backend endpoint the UI uses.

// Account and profile
export const getMe = () => api.get("/users/me");
export const updateAccount = (data) => api.put("/users/me", data);
export const updateProfile = (data) => api.put("/users/me/profile", data);
export const updateEmergencyContacts = (contacts) => api.put("/users/me/emergency-contacts", { contacts });
export const deleteAccount = () => api.delete("/users/me");
export const getSystemStatus = () => api.get("/system/status");

// Daily metrics and risk
export const logMetrics = (data) => api.put("/health/metrics", data);
export const getMetrics = (days = 30) => api.get("/health/metrics", { params: { days } });
export const getToday = () => api.get("/health/today");
export const analyzeHealth = () => api.post("/health/analyze");
export const getPredictions = (limit = 10) => api.get("/health/predictions", { params: { limit } });

// Chat
export const sendChat = (messages, mode = "general") => api.post("/chat", { messages, mode });

// Nutrition
export const analyzeMealPhoto = (image) => api.post("/nutrition/meal/analyze", { image });
export const logMeal = (meal) => api.post("/nutrition/meals", meal);
export const getMeals = (days = 7) => api.get("/nutrition/meals", { params: { days } });
export const deleteMeal = (id) => api.delete(`/nutrition/meals/${id}`);
export const analyzeGroceryPhoto = (image) => api.post("/nutrition/grocery/analyze", { image });
export const lookupBarcode = (code) => api.get(`/nutrition/product/${encodeURIComponent(code)}`);
export const getGroceryHistory = () => api.get("/nutrition/grocery/history");

// Goals
export const planGoal = (description, weeks) => api.post("/goals/plan", { description, ...(weeks ? { weeks } : {}) });
export const createGoal = (goal) => api.post("/goals", goal);
export const getGoals = () => api.get("/goals");
export const checkinGoal = (id, habitsDone, day) => api.put(`/goals/${id}/checkin`, { habitsDone, ...(day ? { day } : {}) });
export const setGoalStatus = (id, status) => api.patch(`/goals/${id}`, { status });
export const deleteGoal = (id) => api.delete(`/goals/${id}`);

// Environment
export const getExposome = (lat, lon) => api.get("/exposome", { params: { lat, lon } });
export const getExposomeHistory = () => api.get("/exposome/history");

// Places, emergency, appointments
export const getNearbyPlaces = (params) => api.get("/places/nearby", { params });
export const triggerSos = (data) => api.post("/emergency/sos", data);
export const resolveSos = (id) => api.post(`/emergency/${id}/resolve`);
export const triageSymptoms = (symptoms) => api.post("/appointments/triage", { symptoms });
export const createAppointment = (data) => api.post("/appointments", data);
export const getAppointments = () => api.get("/appointments");
export const setAppointmentStatus = (id, status) => api.patch(`/appointments/${id}`, { status });
export const deleteAppointment = (id) => api.delete(`/appointments/${id}`);
export const downloadAppointmentIcs = async (id) => {
  const res = await api.get(`/appointments/${id}/ics`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment-${id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

// Lab reports
export const readLabReport = (images) => api.post("/labs/read", { images });
export const saveLabReport = (report) => api.post("/labs", report);
export const getLabReports = () => api.get("/labs");
export const deleteLabReport = (id) => api.delete(`/labs/${id}`);
