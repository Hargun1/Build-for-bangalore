import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { useMemo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Stars } from "@react-three/drei";
import { ReactLenis } from "@studio-freight/react-lenis";
import HealthOverview from "../components/Dashboard/HealthOverview";
import "./Dashboard.css";


const FEATURE_CARDS = [
  {
    to: "/glass-body",
    label: "Digital Twin",
    tagline: "Your body, visualized",
    desc: "Explore 3D models of your organs. Each organ shows your own related score, such as heart risk on the heart and air quality on the lungs.",
    icon: "🫀",
    img: "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=1200&q=80",
    accent: "#0891b2",
  },
  {
    to: "/exposome",
    label: "Exposome Radar",
    tagline: "Know your environment",
    desc: "Live air quality on India's CPCB scale, heat, UV and rain where you are, plus the best 2-hour window to exercise outdoors today.",
    icon: "🌍",
    img: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80",
    accent: "#059669",
  },
  {
    to: "/appointments",
    label: "Appointments",
    tagline: "The right doctor, nearby",
    desc: "Describe your symptoms, get an AI triage of which specialist to see and how soon, then pick a real clinic near you and add it to your calendar.",
    icon: "🏥",
    img: "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=1200&q=80",
    accent: "#4f46e5",
  },
  {
    to: "/grocery",
    label: "Grocery Scanner",
    tagline: "Scan. Learn. Eat better.",
    desc: "Photograph a meal for calories and macros, scan a barcode for its Nutri-Score and allergens, or snap a grocery bill for a basket health score.",
    icon: "🥗",
    img: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80",
    accent: "#d97706",
  },
  {
    to: "/goals",
    label: "Goal Planner",
    tagline: "Micro-habits, macro results",
    desc: "Describe a goal in your own words. AI turns it into a weekly plan, and progress is measured from the numbers you actually log.",
    icon: "🎯",
    img: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1200&q=80",
    accent: "#db2777",
  },
  {
    to: "/wearable",
    label: "Live Vitals",
    tagline: "Your heart, in real time",
    desc: "Connect a Bluetooth heart-rate strap or watch for live heart rate and HRV, or enter readings by hand. A clearly labelled simulator is there for demos.",
    icon: "⌚",
    img: "https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=1200&q=80",
    accent: "#7c3aed",
  },
  {
    to: "/emergency",
    label: "Life Saver",
    tagline: "When seconds matter",
    desc: "One button emails your emergency contacts your live location and nearest hospitals, and prepares WhatsApp messages and 112/108 calls.",
    icon: "🚨",
    img: "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=1200&q=80",
    accent: "#dc2626",
  },
  {
    to: "/chat",
    label: "Health Chat",
    tagline: "Your AI health companion",
    desc: "Ask about symptoms, sleep or food. Answers use your profile and recent logs, and emergency warning signs are caught by fixed safety rules first.",
    icon: "💬",
    img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80",
    accent: "#06b6d4",
  },
];

// ─── Orbiting Dot ───────────────────────────────────────────────────
function OrbitingDot({ radius, speed, color, offset, tilt }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + offset;
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t) * radius;
    ref.current.position.y = Math.sin(t * 1.5 + tilt) * 0.4;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.055, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={6}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── 3D Hero Scene — Orbital Rings + Wireframe Core ─────────────────
function HeroScene() {
  const groupRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const ring3Ref = useRef();
  const coreRef = useRef();
  const icoRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Whole group slow rotation
    groupRef.current.rotation.y = t * 0.08;

    // Each ring on its own axis
    ring1Ref.current.rotation.x = t * 0.3;
    ring1Ref.current.rotation.z = t * 0.08;

    ring2Ref.current.rotation.y = t * 0.22;
    ring2Ref.current.rotation.x = Math.PI / 3 + t * 0.05;

    ring3Ref.current.rotation.z = t * 0.18;
    ring3Ref.current.rotation.x = -Math.PI / 4 + t * 0.04;

    // Wireframe rotates independently
    icoRef.current.rotation.x = t * 0.12;
    icoRef.current.rotation.z = t * 0.08;

    // Core pulses
    const pulse = 1 + Math.sin(t * 2) * 0.1;
    coreRef.current.scale.set(pulse, pulse, pulse);
  });

  return (
    <group ref={groupRef}>
      {/* Glowing inner core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color="#818cf8"
          emissive="#6366f1"
          emissiveIntensity={2.5}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>

      {/* Wireframe icosahedron */}
      <mesh ref={icoRef}>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshStandardMaterial
          color="#a5b4fc"
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Orbital ring 1 — cyan */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[2.2, 0.008, 16, 120]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>

      {/* Orbital ring 2 — violet */}
      <mesh ref={ring2Ref}>
        <torusGeometry args={[2.7, 0.008, 16, 120]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>

      {/* Orbital ring 3 — green */}
      <mesh ref={ring3Ref}>
        <torusGeometry args={[3.2, 0.006, 16, 120]} />
        <meshStandardMaterial
          color="#4ade80"
          emissive="#4ade80"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>

      {/* Orbiting dots on each ring path */}
      <OrbitingDot radius={2.2} speed={0.7} color="#06b6d4" offset={0} tilt={0} />
      <OrbitingDot radius={2.2} speed={0.7} color="#06b6d4" offset={Math.PI} tilt={0.5} />
      <OrbitingDot radius={2.7} speed={0.5} color="#8b5cf6" offset={Math.PI / 2} tilt={1} />
      <OrbitingDot radius={2.7} speed={0.5} color="#8b5cf6" offset={Math.PI * 1.5} tilt={1.5} />
      <OrbitingDot radius={3.2} speed={0.35} color="#4ade80" offset={Math.PI / 3} tilt={2} />

      {/* Lighting */}
      <Environment preset="city" />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 0, 0]} intensity={3} color="#6366f1" distance={8} />
      <pointLight position={[4, 2, 3]} intensity={1} color="#06b6d4" distance={10} />
    </group>
  );
}

// ─── Feature Row Component (alternating left/right) ─────────────────
function FeatureRow({ card, index }) {
  const isReversed = index % 2 === 1;

  return (
    <motion.div
      className={`feature-row ${isReversed ? "feature-row--reversed" : ""}`}
      initial={{ opacity: 0, x: isReversed ? 60 : -60 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Image Side */}
      <div className="feature-row-visual">
        <div
          className="feature-row-image"
          style={{ backgroundImage: `url(${card.img})` }}
        />
        <div className="feature-row-image-overlay" style={{ "--accent": card.accent }} />
        <div className="feature-row-icon-badge">
          <span>{card.icon}</span>
        </div>
        <div className="feature-row-number">
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>

      {/* Detail Side */}
      <div className="feature-row-detail">
        <span className="feature-row-tagline" style={{ color: card.accent }}>
          {card.tagline}
        </span>
        <h3 className="feature-row-title">{card.label}</h3>
        <p className="feature-row-desc">{card.desc}</p>
        <Link to={card.to} className="feature-row-cta" style={{ "--accent": card.accent }}>
          <span>Explore {card.label}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Dashboard Component ─────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const heroRef = useRef(null);
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 6}s`,
        animationDuration: `${4 + Math.random() * 6}s`,
        width: `${2 + Math.random() * 3}px`,
        height: `${2 + Math.random() * 3}px`,
        opacity: 0.15 + Math.random() * 0.25,
      })),
    []
  );

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <ReactLenis root options={{ lerp: 0.07, smoothWheel: true }}>
      <div className="dashboard-container dark">
        {/* ── Sticky Nav ── */}
        <nav className="nav-header">
          <div className="nav-inner">
            <div className="user-badge">
              <div className="user-avatar">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="user-info">
                <span className="user-greeting">{greeting()}</span>
                <span className="user-name">{user?.name || "User"}</span>
              </div>
            </div>
            <div className="nav-actions">
              <Link to="/chat" className="logout-btn">Health chat</Link>
              <Link to="/profile" className="logout-btn">{user?.isGuest ? "Guest · Profile" : "Profile"}</Link>
            </div>
          </div>
        </nav>

        {/* ── Hero Banner ── */}
        <section className="hero-section" ref={heroRef}>
          {/* Animated EKG pulse line */}
          <div className="hero-pulse-line">
            <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
              <path
                className="pulse-path"
                d="M0,30 L300,30 L330,30 L345,5 L360,55 L375,10 L390,45 L405,25 L420,30 L900,30 L930,30 L945,5 L960,55 L975,10 L990,45 L1005,25 L1020,30 L1200,30"
                fill="none"
                stroke="url(#pulseGrad)"
                strokeWidth="1.5"
              />
              <defs>
                <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
                  <stop offset="20%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6" />
                  <stop offset="80%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Floating particles (CSS) */}
          <div className="hero-particles">
            {particles.map((style, i) => (
              <div
                key={i}
                className="hero-particle"
                style={style}
              />
            ))}
          </div>

          <div className="hero-canvas-container">
            <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
              <Stars
                radius={80}
                depth={60}
                count={2500}
                factor={3}
                saturation={0}
                fade
                speed={0.5}
              />
              <HeroScene />
            </Canvas>
          </div>

          <motion.div
            className="hero-content"
            style={{ opacity: heroOpacity, y: heroY, scale: heroScale }}
          >
            <motion.div
              className="hero-badge"
              initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              <span className="hero-badge-dot" />
              Live Dashboard
            </motion.div>

            <h1 className="hero-title">
              {"Your Health.".split(" ").map((word, i) => (
                <motion.span
                  key={i}
                  className="hero-word"
                  initial={{ opacity: 0, y: 60, rotateX: -70 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{
                    duration: 0.9,
                    delay: 0.25 + i * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {word}{" "}
                </motion.span>
              ))}
              <br />
              <motion.span
                className="hero-title-accent hero-word"
                initial={{ opacity: 0, y: 60, rotateX: -70 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{
                  duration: 0.9,
                  delay: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                Redefined.
              </motion.span>
            </h1>

            <motion.p
              className="hero-subtitle"
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.75 }}
            >
              Next-generation proactive wellness powered by AI, real-time
              biometrics, and deeply integrated health modules.
            </motion.p>

            <motion.div
              className="hero-cta-group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.95 }}
            >
              <a href="#overview" className="hero-cta-primary">
                See my health
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </a>
            </motion.div>
          </motion.div>

          <div className="hero-scroll-indicator">
            <motion.div
              className="scroll-line"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </section>

        {/* ── Real data: today, risk scores, trends ── */}
        <section className="stats-section" id="overview" style={{ background: "#080a0f", padding: "3rem 0 4rem" }}>
          <div className="ui-container" style={{ paddingTop: "1rem" }}>
            <HealthOverview />
          </div>
        </section>

        {/* ── Feature Showcase ── */}
        <section className="features-section" id="features">
          <div className="features-header">
            <motion.h2
              className="section-title"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              Ecosystem
            </motion.h2>
            <motion.p
              className="features-subtitle"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.15 }}
            >
              Eight modules that share one profile and one daily log, each built on
              free, open data or a published method.
            </motion.p>
          </div>

          <div className="features-list">
            {FEATURE_CARDS.map((card, index) => (
              <FeatureRow key={card.to} card={card} index={index} />
            ))}
          </div>
        </section>

        {/* ── Footer CTA ── */}
        <section className="footer-section">
          <motion.div
            className="footer-content"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="footer-headline">
              Ready to optimize
              <br />
              your biology?
            </h2>
            <p className="footer-sub">
              All interconnected. All intelligent. All available at a single tap.
            </p>
            <a href="#overview" className="footer-btn">
              <span>Back to my numbers</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </motion.div>
        </section>
      </div>
    </ReactLenis>
  );
}
