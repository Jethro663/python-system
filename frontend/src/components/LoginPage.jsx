import { useState } from "react";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function getDefaultRoute(role) {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/student";
}

const QUICK_ACCESS = [
  {
    label: "Admin",
    email: "admin@nexora.local",
    password: "Admin123!",
    note: "System-wide setup and reporting",
  },
  {
    label: "Teacher",
    email: "teacher.demo@nexora.local",
    password: "Teacher123!",
    note: "Classes, grading, and interventions",
  },
  {
    label: "Student",
    email: "student.demo@nexora.local",
    password: "Student123!",
    note: "Modules, submissions, and results",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@nexora.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from?.pathname;

  return (
    <div className="login-shell">
      <div className="login-shell__grid" />
      <div className="login-shell__glow login-shell__glow--primary" />
      <div className="login-shell__glow login-shell__glow--secondary" />

      <div className="login-shell__inner">
        <section className="login-brand-stack">
          <div className="login-brand-stack__mark">
            <div className="login-brand-stack__mark-ring" />
            <div className="login-brand-stack__mark-core">
              <ShieldCheck size={32} />
            </div>
            <div className="login-brand-stack__mark-badge">
              <Zap size={14} />
            </div>
          </div>

          <div className="login-brand-stack__copy">
            <span className="login-brand-stack__eyebrow">
              <Sparkles size={12} />
              Nexora Portal
            </span>
            <h1>Welcome back</h1>
            <p>
              Access the Python rebuild through the same admin-first, teacher-capable, student-ready
              workflow direction as the parent LMS.
            </p>
          </div>

          <div className="login-brand-stack__chips">
            <span>Flask auth</span>
            <span>Role-routed portals</span>
            <span>Capstone-informed flow</span>
          </div>
        </section>

        <section className="login-auth-card">
          <div className="login-auth-card__accent" />

          <form
            className="login-auth-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setSubmitting(true);
              setError("");
              try {
                const user = await login(email.trim().toLowerCase(), password);
                navigate(destination || getDefaultRoute(user.role), { replace: true });
              } catch (authError) {
                setError(authError.message || "Login failed.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div className="login-auth-form__header">
              <p className="login-auth-form__badge">Sign in</p>
              <h2>Portal access</h2>
              <p>Use a seeded account below or continue with your own admin-created credentials.</p>
            </div>

            <div className="login-quick-access">
              {QUICK_ACCESS.map((account) => (
                <button
                  key={account.label}
                  className="login-quick-access__card"
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setError("");
                  }}
                >
                  <strong>{account.label}</strong>
                  <span>{account.note}</span>
                </button>
              ))}
            </div>

            <label className="field">
              <span>Email address</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}

            <button className="primary-button login-auth-form__submit" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Enter portal"}
            </button>
          </form>

          <div className="login-auth-card__footer">
            <ShieldCheck size={16} />
            <span>Secure session-backed access for admin, teacher, and student roles</span>
          </div>
        </section>
      </div>
    </div>
  );
}
