# PranexusAI

PranexusAI is a full-stack health intelligence platform for prevention, monitoring, and guided action. It combines a React/Vite frontend, a Node/Express API, a MongoDB data layer, and a FastAPI AI microservice to cover personal health tracking, environmental risk, nutrition analysis, emergency support, and doctor matching.

## Overview

The app is organized into three working layers:

- Frontend: a multi-page React application for login, dashboards, health tools, and interactive wellness views.
- Backend: an authenticated Express API for user data, metrics, appointments, reports, grocery scans, exposome data, and proxying AI requests.
- AI service: a FastAPI microservice that powers prediction, recommendations, scoring, and matching workflows.

## Features

### Frontend Experience

- Authentication flows for login, registration, and email verification.
- A main dashboard for health status and analytics.
- A 3D-style Glass Body experience for organ and body-system exploration.
- Exposome views for weather, air quality, and environmental health context.
- Appointment booking and appointment history management.
- Grocery and food analysis workflows, including scan-based nutrition review.
- Goal planning for wellness milestones and progress tracking.
- Wearable health panels for sleep, stress, activity, temperature, cardiovascular data, and related signals.
- Emergency tools for SOS, vitals monitoring, first aid guidance, timelines, contacts, and alerts.
- Health chat for question-and-answer style support.

### Backend Capabilities

- JWT-based authentication.
- Email verification with OTP and resend support.
- User profile access and updates.
- Emergency contacts management.
- Daily health metric logging and retrieval.
- AI-backed health prediction and historical prediction storage.
- Medical report creation and retrieval.
- Appointment CRUD for signed-in users.
- Grocery scan history and image analysis support.
- Food plate analysis endpoint.
- Health Q&A endpoint.
- Exposome capture with current conditions, calendar suggestions, and history.
- Doctor listing and symptom-based doctor matching.

### AI Microservice Capabilities

The FastAPI service exposes the following intelligence routes:

- `/predict/risk` - disease and risk score prediction.
- `/recommend` - personalized health recommendations.
- `/baseline-compare` - compare current habits against baseline behavior.
- `/glycemic-curve` - glucose response modeling.
- `/sleep-debt` - sleep deficit analysis.
- `/dopamine-score` - screen-time and stimulation impact scoring.
- `/age-biological` - biological age estimation.
- `/grocery-analyze` - grocery cart nutrition analysis.
- `/grocery-analyze/image` - grocery image analysis.
- `/exposome-risk` - environmental risk scoring.
- `/goal-plan` - milestone and goal planning.
- `/emergency-detect` - emergency pattern detection.
- `/food-plate` - plate and meal analysis.
- `/health-qa` - health question answering.
- `/doctor-match` - symptom-based doctor matching.

## Tech Stack

- Frontend: React, Vite, React Router, Framer Motion, GSAP, Three.js, Recharts, Swiper.
- Backend: Node.js, Express, MongoDB, Mongoose, JWT, Nodemailer, Axios.
- AI Service: Python, FastAPI, Pydantic, OpenRouter-backed analysis helpers.

## Project Structure

```text
buildForBenglore/
├── client/                  React frontend
│   ├── src/
│   │   ├── pages/           Route-level screens
│   │   ├── components/      Feature components
│   │   ├── context/         Auth and vitals state
│   │   ├── hooks/           Shared React hooks
│   │   └── services/        API client wrappers
│   └── package.json
├── server/                  Node/Express backend
│   ├── routes/              API route groups
│   ├── models/              Mongoose models
│   ├── middleware/          Auth middleware
│   ├── services/            External service adapters
│   └── server.js            API entry point
├── ai-service/              FastAPI microservice
│   ├── routers/             AI endpoints
│   ├── services/            Risk and scoring logic
│   ├── utils/               Shared helpers
│   └── main.py              AI entry point
├── docker-compose.yml       Optional local stack
├── package.json             Root scripts
└── pranexusai_project_plan.md
```

## Getting Started

### Prerequisites

- Node.js 18 or newer.
- Python 3.9 or newer.
- MongoDB connection string.

### Install

```bash
npm install
npm run install:all
```

### Environment Variables

Create the needed environment files and set the values below.

```bash
# server/.env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/pranexusai
JWT_SECRET=your_random_secret_here
CLIENT_URL=http://localhost:3000

# ai-service/.env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/pranexusai
OPENROUTER_API_KEY=your_openrouter_key_here
CORS_ORIGINS=http://localhost:3000,http://localhost:5001

# client/.env
VITE_API_URL=http://localhost:5001/api
VITE_API_PROXY_TARGET=http://localhost:5001
```

### Run Locally

The frontend runs on port `3000`, the backend defaults to `5001`, and the AI service runs on `8000`.

```bash
# Terminal 1
cd client
npm run dev

# Terminal 2
cd server
npm run dev

# Terminal 3
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

You can also start the full stack with Docker if you have it configured.

```bash
docker-compose up
```

## Main Routes

### Frontend Pages

- `/login`
- `/register`
- `/verify-email`
- `/dashboard`
- `/glass-body`
- `/exposome`
- `/appointments`
- `/grocery`
- `/goals`
- `/wearable`
- `/emergency`
- `/chat`

### Backend API Groups

- `/api/auth` - register, login, verify email, resend verification.
- `/api/users` - current user profile and emergency contacts.
- `/api/health` - metrics, predictions, reports, and AI health actions.
- `/api/appointments` - appointment create, list, and update.
- `/api/grocery` - scan, history, and image-based grocery analysis.
- `/api/food-plate` - plate analysis.
- `/api/health-qa` - AI health question answering.
- `/api/exposome` - current environmental risk, suggestions, and history.
- `/api/doctors` - doctor listing and AI-assisted matching.

## Quick API Checks

```bash
curl http://localhost:5001/api/ping
curl http://localhost:8000/ping
```

## Notes

- The backend is configured to serve the React app in production when a frontend build is present.
- The client Vite dev server proxies `/api` calls to the backend.
- The AI service falls back gracefully when external providers are unavailable, so the app can still return deterministic results for many flows.

## Deployment

The repository includes Docker and Render-oriented deployment files. If you deploy the backend as a single service, build the client first so `client/dist` is available for static serving.

---

## 🛠️ Troubleshooting

### "MongoDB connection failed"
- Check MONGODB_URI in `server/.env`
- Ensure MongoDB Atlas IP whitelist includes your IP
- Test connection: `mongosh "mongodb+srv://..."`

### "Port 3000/5000/8000 already in use"
- Kill existing process: `lsof -i :5000` / `kill -9 <PID>`
- Or change port in `vite.config.js` / `server/.env`

### "Python not found"
- Install Python 3.9+
- Install FastAPI: `pip install -r ai-service/requirements.txt`

### "CORS error from frontend"
- Check `AI_SERVICE_URL` in `server/.env`
- Ensure CORS is enabled in `ai-service/main.py`

---

## 📚 Resources

- **Full Architecture:** `pranexusai_project_plan.md`
- **React Starter:** https://vitejs.dev/guide/ssr.html
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **MongoDB:** https://www.mongodb.com/docs/
- **JWT Auth:** https://jwt.io/

---

## 🤝 Team Guidelines

- **Use branches:** `dev/feature-name` per person
- **Component organization:** Each dev owns their component folder — minimize merge conflicts
- **API contract:** Agreed on Day 1 — don't change request/response schemas without sync
- **Code style:** Use Prettier (client/server) + Black (Python)
- **Logs:** Centralize logs for debugging (use `winston` / `python logging`)

---

**Questions?** Check the full plan in `pranexusai_project_plan.md` or comment in your component's TODO sections.

Happy building! 🚀
"# Build-for-bangalore" 
