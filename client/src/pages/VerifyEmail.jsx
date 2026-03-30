import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle"); // idle, verifying, success, error
  const [message, setMessage] = useState("Enter the OTP sent to your email.");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const queryEmail = searchParams.get("email");
    if (queryEmail) {
      setEmail(queryEmail);
    }

    const token = searchParams.get("token");
    if (!token) {
      return;
    }

    const verifyLegacyToken = async () => {
      setStatus("verifying");
      setMessage("Verifying your email...");
      try {
        const response = await api.post("/auth/verify-email", { token });
        setStatus("success");
        setMessage("Email verified successfully! Redirecting to dashboard...");
        localStorage.setItem("token", response.data.token);
        setTimeout(() => navigate("/dashboard"), 1500);
      } catch (error) {
        setStatus("error");
        setMessage(error.response?.data?.message || "Verification failed. Please try OTP verification.");
      }
    };

    verifyLegacyToken();
  }, [searchParams, navigate]);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus("verifying");
    setMessage("Verifying OTP...");

    try {
      const response = await api.post("/auth/verify-email", {
        email: email.trim(),
        otp: otp.trim(),
      });

      setStatus("success");
      setMessage("Email verified successfully! Redirecting to dashboard...");
      localStorage.setItem("token", response.data.token);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error) {
      setStatus("error");
      setMessage(error.response?.data?.message || "Verification failed. Please check the OTP and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter your email to resend OTP.");
      return;
    }

    try {
      await api.post("/auth/resend-verification", { email: email.trim() });
      setStatus("idle");
      setMessage("A new OTP has been sent to your email.");
    } catch (error) {
      setStatus("error");
      setMessage(error.response?.data?.message || "Failed to resend OTP.");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h1>Email Verification</h1>
        <p style={styles.hint}>Enter the 6-digit OTP sent to your inbox.</p>

        {status === "verifying" && (
          <div style={styles.verifying}>
            <div style={styles.spinner}></div>
            <p>{message}</p>
          </div>
        )}

        {status === "success" && (
          <div style={styles.success}>
            <div style={styles.checkmark}>✓</div>
            <p>{message}</p>
          </div>
        )}

        {status === "error" && (
          <div style={styles.error}>
            <div style={styles.errorIcon}>✕</div>
            <p>{message}</p>
          </div>
        )}

        <form style={styles.form} onSubmit={handleVerifyOtp}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="text"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            maxLength={6}
          />
          <button style={styles.button} type="submit" disabled={submitting}>
            {submitting ? "Verifying..." : "Verify OTP"}
          </button>
        </form>

        <button style={styles.linkButton} type="button" onClick={handleResend}>
          Resend OTP
        </button>
        <button style={styles.secondaryButton} type="button" onClick={() => navigate("/register")}>
          Back to Register
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
  },
  box: {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    textAlign: "center",
    maxWidth: "400px",
  },
  hint: {
    color: "#555",
    marginBottom: "18px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "18px",
  },
  input: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "15px",
  },
  verifying: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #4CAF50",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  success: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    color: "#4CAF50",
  },
  checkmark: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    backgroundColor: "#4CAF50",
    color: "white",
    fontSize: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    color: "#f44336",
  },
  errorIcon: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    backgroundColor: "#f44336",
    color: "white",
    fontSize: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "16px",
  },
  linkButton: {
    marginTop: "10px",
    background: "none",
    border: "none",
    color: "#0f766e",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryButton: {
    marginTop: "8px",
    background: "none",
    border: "none",
    color: "#666",
    cursor: "pointer",
  },
};
