import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import "./Login.css";
import "./Landing.css";

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing-page">
      <div className="landing-background-grid" aria-hidden="true" />

      <motion.header
        className="landing-topbar"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="landing-brand">
          <span className="landing-brand-dot" />
          PranexusAI
        </div>
        <div className="landing-topbar-actions">
          <Link to="/login" className="landing-top-link">Sign In</Link>
          <Link to="/register" className="landing-top-cta">Start Free</Link>
        </div>
      </motion.header>

      <main className="landing-main">
        <motion.section
          className="landing-copy"
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="landing-kicker">Preventive healthcare platform</p>
          <h1>Catch risk early. Stay in rhythm with your body.</h1>
          <p className="landing-subtitle">
            One calm dashboard for brain, heart, lungs, and metabolic signals,
            powered by always-on clinical AI.
          </p>
          <div className="landing-cta-group">
            <Link to="/register" className="landing-cta-primary">Create account</Link>
            <Link to="/login" className="landing-cta-secondary">Open workspace</Link>
          </div>
        </motion.section>

        <motion.section
          className="landing-showcase"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <div className="landing-body-cluster" aria-hidden="true">
            <motion.div
              className="landing-core"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              Vital Core
            </motion.div>

            {[
              { label: "Brain", cls: "cluster-brain", delay: 0.2 },
              { label: "Heart", cls: "cluster-heart", delay: 0.4 },
              { label: "Lungs", cls: "cluster-lungs", delay: 0.6 },
              { label: "Liver", cls: "cluster-liver", delay: 0.8 },
              { label: "Sleep", cls: "cluster-sleep", delay: 1 },
            ].map((item) => (
              <motion.div
                key={item.label}
                className={`landing-cluster-pill ${item.cls}`}
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 4.5,
                  delay: item.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {item.label}
              </motion.div>
            ))}
          </div>

          <div className="landing-stat-grid">
            <article>
              <strong>24/7</strong>
              <span>Signal tracking</span>
            </article>
            <article>
              <strong>5x</strong>
              <span>Faster screening loop</span>
            </article>
            <article>
              <strong>1 app</strong>
              <span>Whole-body context</span>
            </article>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
