import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Github,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Trophy,
  UserRound,
  UsersRound,
  XCircle,
  Code,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  CircleHelp,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  Mic,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  Wand2,
} from "lucide-react";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const ACCESS_TOKEN_KEY = "rsa_student_access_token";
const ADMIN_TOKEN_KEY = "rsa_admin_token";

/* ------------------------------------------------------------------ *
 *  Hash routing
 *
 *  Navigation used to live only in React state, so refreshing threw you
 *  back to the overview and the browser Back button did nothing. Keeping
 *  it in the URL fixes both, and makes a given opportunity linkable.
 *
 *    #/admin
 *    #/admin/students
 *    #/admin/company/<companyId>
 *    #/admin/company/<companyId>/opp/<opportunityId>
 *    #/student
 *    #/student/feedback
 * ------------------------------------------------------------------ */
function parseHash() {
  return window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  // push -> a new history entry so Back works; replace -> silent sync.
  const navigate = useCallback((parts, { replace = false } = {}) => {
    const next = "#/" + parts.filter(Boolean).join("/");
    if (window.location.hash === next) return;
    if (replace) {
      window.history.replaceState(null, "", next);
      setRoute(parseHash());
    } else {
      window.location.hash = next;
    }
  }, []);

  return [route, navigate];
}

async function apiRequest(path, { method = "GET", body, token, adminToken } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    data = JSON.parse(text);
  }

  if (!response.ok) {
    // A 401 on an authenticated request means the token expired/was revoked.
    // Signal the app so it can show the session-expired screen.
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    throw new Error(data?.detail || "Something went wrong");
  }

  return data;
}

// Remember scroll positions per route — both the window AND any inner scroll
// container tagged with data-scroll-key (long tables/lists) — so navigating back
// returns you exactly where you were, not to the top / first row.
// - a single capture-phase listener catches window + container scrolls and saves
//   under the *live* route key, so a route change can't record under the wrong key;
// - a "settling" flag ignores scrolls during a transition, so the browser snapping
//   a shorter page to top can't clobber the saved position;
// - the restore re-applies (window + each container) until reached, surviving
//   async content that loads in after render.
function useScrollRestoration(routeKey) {
  const positions = useRef({});
  const liveKey = useRef(routeKey);
  const settling = useRef(false);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const onScroll = (event) => {
      if (settling.current) return;
      const t = event.target;
      const key = liveKey.current;
      if (t === document || t === document.documentElement || t === document.body) {
        positions.current[`${key}::win`] = window.scrollY;
      } else if (t && t.nodeType === 1 && t.hasAttribute && t.hasAttribute("data-scroll-key")) {
        positions.current[`${key}::${t.getAttribute("data-scroll-key")}`] = t.scrollTop;
      }
    };
    // capture phase so it catches scroll from any inner container (scroll doesn't bubble)
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);

  useLayoutEffect(() => {
    liveKey.current = routeKey;
    settling.current = true;
    let cancelled = false;
    let tries = 0;
    const finish = () => { settling.current = false; };
    const restore = () => {
      if (cancelled) return;
      let reached = true;
      const winTarget = positions.current[`${routeKey}::win`] || 0;
      window.scrollTo(0, winTarget);
      if (winTarget > 0 && Math.abs(window.scrollY - winTarget) > 2) reached = false;
      document.querySelectorAll("[data-scroll-key]").forEach((el) => {
        const saved = positions.current[`${routeKey}::${el.getAttribute("data-scroll-key")}`];
        if (saved != null && saved > 0) {
          el.scrollTop = saved;
          if (Math.abs(el.scrollTop - saved) > 2) reached = false;
        }
      });
      tries += 1;
      if (!reached && tries < 90) requestAnimationFrame(restore);
      else finish();
    };
    requestAnimationFrame(restore);
    return () => { cancelled = true; finish(); };
  }, [routeKey]);
}

function App() {
  const [route, navigate] = useHashRoute();
  useScrollRestoration(route.join("/"));
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  // The URL decides the mode when it says so, otherwise fall back to whichever
  // token we hold. This is what keeps a refresh on an admin page in admin mode.
  const [mode, setMode] = useState(() => {
    const first = parseHash()[0];
    if (first === "admin" || first === "student") return first;
    return localStorage.getItem(ADMIN_TOKEN_KEY) ? "admin" : "student";
  });
  const [student, setStudent] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(Boolean(token) && mode === "student");
  const [authView, setAuthView] = useState("login");
  const [sessionExpired, setSessionExpired] = useState(false);

  // Any 401 while we hold a token means the session expired mid-use.
  useEffect(() => {
    function onExpired() {
      if (localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY)) {
        setSessionExpired(true);
      }
    }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  // Follow Back/Forward between the two modes.
  useEffect(() => {
    const first = route[0];
    if ((first === "admin" || first === "student") && first !== mode) setMode(first);
  }, [route, mode]);

  useEffect(() => {
    if (mode !== "student" || !token) {
      setStudent(null);
      setLoadingStudent(false);
      return;
    }

    let isCurrent = true;
    setLoadingStudent(true);
    apiRequest("/students/me", { token })
      .then((data) => {
        if (isCurrent) setStudent(data);
      })
      .catch(() => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        if (isCurrent) {
          setToken(null);
          setStudent(null);
        }
      })
      .finally(() => {
        if (isCurrent) setLoadingStudent(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token, mode]);

  function handleAuthenticated(accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    setToken(accessToken);
    setMode("student");
    navigate(["student"], { replace: true });
  }

  function handleLogout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setToken(null);
    setStudent(null);
    setAuthView("login");
    setMode("student");
    navigate(["student"], { replace: true });
  }

  function handleAdminAuthenticated(value) {
    localStorage.setItem(ADMIN_TOKEN_KEY, value);
    setAdminToken(value);
    setMode("admin");
    navigate(["admin"], { replace: true });
  }

  function handleAdminLogout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
    setMode("student");
    navigate(["student"], { replace: true });
  }

  function switchMode(next) {
    setMode(next);
    navigate([next]);
  }

  // Clear the expired session and drop back to the right login page.
  function goToLoginAfterExpiry() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setAdminToken(null);
    setStudent(null);
    setSessionExpired(false);
    setAuthView("login");
    navigate([mode === "admin" ? "admin" : "student"], { replace: true });
  }

  if (sessionExpired) {
    return <SessionExpired onLogin={goToLoginAfterExpiry} />;
  }

  if (loadingStudent) {
    return <LoadingScreen />;
  }

  if (adminToken && mode === "admin") {
    return (
      <AdminDashboard
        adminToken={adminToken}
        onLogout={handleAdminLogout}
        route={route}
        navigate={navigate}
      />
    );
  }

  // One login for everyone: the backend routes by identifier (email -> admin,
  // mobile number -> student) and returns the role we send them to.
  if (!token || !student) {
    return <UnifiedLogin onStudent={handleAuthenticated} onAdmin={handleAdminAuthenticated} />;
  }

  return (
    <StudentDashboard
      student={student}
      token={token}
      onLogout={handleLogout}
      route={route}
      navigate={navigate}
    />
  );
}

function LoadingScreen() {
  return (
    <main className="app-shell centered">
      <Loader2 className="spin" size={28} />
    </main>
  );
}

function SessionExpired({ onLogin }) {
  return (
    <main className="session-expired">
      <div className="session-card">
        <span className="session-icon"><KeyRound size={26} /></span>
        <h1>Session expired</h1>
        <p>Your session has expired. Please log in again to continue.</p>
        <button type="button" className="primary-button" onClick={onLogin}>
          <LogOut size={18} />
          Log in again
        </button>
      </div>
    </main>
  );
}

function UnifiedLogin({ onStudent, onAdmin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [view, setView] = useState("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // The backend returns the role; send them to the matching dashboard.
  function route(data) {
    if (!data.access_token) return;
    if (data.role === "admin") onAdmin(data.access_token);
    else onStudent(data.access_token);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: { identifier, password } });
      if (data.status === "password_reset_required") {
        setResetToken(data.reset_token);
        setView("reset");
        setMessage("Create a new password to continue.");
        return;
      }
      route(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetPassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/auth/set-password", { method: "POST", body: { reset_token: resetToken, new_password: newPassword } });
      const data = await apiRequest("/auth/login", { method: "POST", body: { identifier, password: newPassword } });
      if (data.access_token) {
        route(data);
      } else {
        setView("login");
        setMessage("Password updated. Please log in again.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">
            <ShieldCheck size={24} />
          </span>
          <div>
            <h1>RSA sign in</h1>
            <p>sign in with your mobile number</p>
          </div>
        </div>

        {view === "login" ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>Mobile number</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Mobile number (student) or email (admin)"
                autoComplete="username"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <div className="password-input">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <StatusMessage error={error} message={message} />

            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
              Log in
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSetPassword}>
            <div className="reset-header">
              <KeyRound size={22} />
              <div>
                <h2>Create new password</h2>
                <p>Required on your first login or after a password reset.</p>
              </div>
            </div>

            <label>
              <span>New password</span>
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              <span>Confirm password</span>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            <StatusMessage error={error} message={message} />

            <button className="primary-button" type="submit" disabled={submitting || !resetToken}>
              {submitting ? <Loader2 className="spin" size={18} /> : <BadgeCheck size={18} />}
              Save password
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function StatusMessage({ error, message }) {
  if (!error && !message) return null;
  return (
    <div className={error ? "status error" : "status success"}>
      {error ? <AlertCircle size={18} /> : <BadgeCheck size={18} />}
      <span>{error || message}</span>
    </div>
  );
}

/* --- What a student sees of their own RSA report ------------------- */
function StudentReportCard({ report, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showMissed, setShowMissed] = useState(false);
  const overall = report.overall || {};
  const skills = Object.entries(report.skill_ratings || {});
  // A student learns from what they missed — not from re-reading every answer.
  const missed = (report.answers || []).filter((answer) =>
    ["incorrect", "partial", "not_answered"].includes(answer.correctness),
  );

  return (
    <div className="rsa-report" id={`report-${report.id}`}>
      <div className="rsa-report-head">
        <button type="button" className="rsa-expand" onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <div>
            <strong>{report.company?.name || "Company"}</strong>
            <span>
              {report.opportunity?.role || "Role"}
              {report.generated_at ? ` · ${formatDate(report.generated_at)}` : ""}
            </span>
          </div>
        </button>
        {/* No score or verdict here by design: a student gets coaching, not a
            hiring decision. Admins still see both. */}
        <span className="rsa-review-tag">
          <Sparkles size={13} /> Reviewed
        </span>
      </div>

      {open ? (
        <div className="rsa-report-body">
          {overall.summary ? <p className="rsa-summary">{overall.summary}</p> : null}

          {report.interviewer_feedback ? (
            <div className="rsa-quote">
              <MessageSquareQuote size={16} />
              <div>
                <strong>What the interviewer told you</strong>
                <p>{report.interviewer_feedback}</p>
              </div>
            </div>
          ) : null}

          <div className="rsa-cols">
            <div>
              <h4><CheckCircle2 size={15} /> What went well</h4>
              {report.strengths?.length ? (
                <ul>{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : (
                <p className="muted">Nothing recorded.</p>
              )}
            </div>
            <div>
              <h4><Lightbulb size={15} /> Where to improve</h4>
              {report.improvements?.length ? (
                <ul>
                  {report.improvements.map((imp, index) => (
                    <li key={index}>
                      <span className={`rsa-prio ${imp.priority}`}>{imp.priority}</span>
                      <strong>{imp.area}</strong> — {imp.detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nothing recorded.</p>
              )}
            </div>
          </div>

          {skills.length ? (
            <>
              <h4><BarChart3 size={15} /> Skills you showed</h4>
              <div className="rsa-skills">
                {skills.map(([skill, rating]) => (
                  <div className="rsa-skill" key={skill}>
                    <span>{skill}</span>
                    <div className="rsa-bar"><i style={{ width: `${((rating || 0) / 5) * 100}%` }} /></div>
                    <b>{rating ?? "–"}/5</b>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {missed.length ? (
            <div className="rsa-revisit">
              <button type="button" className="rsa-revisit-toggle" onClick={() => setShowMissed((value) => !value)}>
                {showMissed ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                {showMissed ? "Hide" : "Review"} the {missed.length} question{missed.length > 1 ? "s" : ""} worth revisiting
              </button>
              {showMissed ? (
                <div className="rsa-revisit-list">
                  {missed.map((answer, index) => (
                    <div className="rsa-revisit-item" key={index}>
                      <strong>{answer.question_text}</strong>
                      {answer.ideal_answer ? (
                        <p><em>How to answer it:</em> {answer.ideal_answer}</p>
                      ) : answer.feedback ? (
                        <p>{answer.feedback}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* --- Practice bank: real questions asked at real companies ---------- */
function PracticeQuestionCard({ question }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rsa-practice">
      <button type="button" className="rsa-practice-head" onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <div className="rsa-practice-q">
          <strong>{question.question_text}</strong>
          <div className="rsa-practice-meta">
            {question.question_type === "scenario" ? <span className="rsa-cat scenario">scenario</span> : null}
            {question.difficulty ? <span className="mini-count">{question.difficulty}</span> : null}
            {question.times_asked > 1 ? (
              <span className="mini-count good">asked {question.times_asked}×</span>
            ) : null}
            {question.companies?.length ? (
              <span className="rsa-companies">at {question.companies.filter(Boolean).join(", ")}</span>
            ) : null}
          </div>
        </div>
      </button>
      {open ? (
        <div className="rsa-practice-body">
          {question.why_asked ? (
            <div className="rsa-why">
              <h4><CircleHelp size={15} /> Why they ask this</h4>
              <p>{question.why_asked}</p>
            </div>
          ) : null}

          {question.prepare?.length ? (
            <div className="rsa-prep">
              <h4><BookOpenCheck size={15} /> What to prepare</h4>
              <div className="rsa-prep-list">
                {question.prepare.map((item) => (
                  <span className="rsa-prep-chip" key={item}>{item}</span>
                ))}
              </div>
            </div>
          ) : null}

          {question.model_answer ? (
            <div>
              <h4><Lightbulb size={15} /> Model answer</h4>
              <p>{question.model_answer}</p>
            </div>
          ) : null}

          {!question.why_asked && !question.prepare?.length && !question.model_answer ? (
            <p className="muted">No guidance available for this question yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PracticeRow({ question }) {
  const [open, setOpen] = useState(false);
  const diff = (question.difficulty || "").toLowerCase();
  const asked = (question.companies || []).filter(Boolean);
  return (
    <div className="pr">
      <button type="button" className="pr-head" onClick={() => setOpen((v) => !v)}>
        <span className="pr-caret">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
        <span className="pr-main">
          <strong>{question.question_text}</strong>
          <span className="pr-meta">
            {question.difficulty ? <span className={`pr-diff ${diff}`}>{question.difficulty}</span> : null}
            {question.question_type === "scenario" ? <span className="pr-diff scenario">scenario</span> : null}
            {question.times_asked > 1 ? <span className="pr-asked">asked {question.times_asked}×</span> : null}
            {asked.length ? <span className="pr-asked">Asked at {asked.slice(0, 2).join(", ")}</span> : null}
          </span>
        </span>
      </button>
      {open ? (
        <div className="pr-body">
          {question.model_answer ? (
            <>
              <p className="pr-how">How to answer it</p>
              <p className="pr-ideal">{question.model_answer}</p>
            </>
          ) : null}
          {question.prepare?.length ? (
            <div className="pr-prep">{question.prepare.map((p) => <span key={p} className="pr-chip">{p}</span>)}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PracticeGroup({ group, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const companies = useMemo(() => {
    const seen = [];
    (group.questions || []).forEach((q) => (q.companies || []).forEach((c) => { if (c && !seen.includes(c)) seen.push(c); }));
    return seen;
  }, [group]);
  const subtitle = companies.length
    ? `Asked at ${companies.slice(0, 2).join(", ")}${companies.length > 2 ? ` +${companies.length - 2}` : ""}`
    : `${group.questions.length} question${group.questions.length === 1 ? "" : "s"}`;
  return (
    <div className="pg">
      <button type="button" className="pg-head" onClick={() => setOpen((v) => !v)}>
        <span className="pg-cat">{group.category}</span>
        <span className="pg-sub">{subtitle}</span>
        <span className="pg-count">{group.questions.length}</span>
        <span className="pg-caret">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
      </button>
      {open ? (
        <div className="pg-body">
          {group.questions.map((q) => <PracticeRow key={q.question_key} question={q} />)}
        </div>
      ) : null}
    </div>
  );
}

function PracticeBank({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeScenario, setIncludeScenario] = useState(false);
  const [category, setCategory] = useState("");
  const [company, setCompany] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (includeScenario) params.set("include_scenario", "true");
    if (category) params.set("category", category);
    if (company) params.set("company", company);
    if (difficulty) params.set("difficulty", difficulty);
    if (search.trim()) params.set("search", search.trim());
    apiRequest(`/students/me/practice-questions?${params.toString()}`, { token })
      .then((result) => live && setData(result))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [token, includeScenario, category, company, difficulty, search]);

  const questions = data?.questions || [];
  const groups = (data?.groups || []).filter((group) => (group.questions || []).length);

  return (
    <>
      <div className="sd-prac-filter">
        <span className="sd-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            placeholder="Search questions…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </span>
        <select value={company} onChange={(event) => setCompany(event.target.value)}>
          <option value="">All companies</option>
          {(data?.companies || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All tech stacks</option>
          {(data?.categories || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <label className="sd-scenario">
          <input
            type="checkbox"
            checked={includeScenario}
            onChange={(event) => setIncludeScenario(event.target.checked)}
          />
          <span>Include scenario-based{data?.scenario_available ? ` (${data.scenario_available})` : ""}</span>
        </label>
      </div>

      {error ? <StatusMessage error={error} /> : null}
      {loading ? <PanelLoader /> : null}

      {!loading && !questions.length ? (
        <div className="empty-state compact">
          <p>
            {search || category || company || difficulty
              ? "No questions match these filters."
              : "No practice questions yet. They appear here as interviews get analysed."}
          </p>
        </div>
      ) : null}

      {!loading && questions.length ? (
        <div className="sd-prac-groups">
          {/* First topic opens expanded; the rest are collapsible drill-in cards. */}
          {groups.map((group, i) => (
            <PracticeGroup key={group.category} group={group} defaultOpen={i === 0} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function StudentReportsView({ reports, loading, focusId, onPractice = () => {} }) {
  return (
    <div className="sd-feedback">
      <div className="sd-view-head">
        <h2>Interview feedback</h2>
        <p>Coaching notes from your real interviews — what went well, and what to fix before the next one.</p>
      </div>

      {loading ? (
        <PanelLoader />
      ) : reports.length ? (
        <div className="rsa-reports">
          {reports.map((report) => (
            <StudentReportCard
              key={report.id}
              report={report}
              defaultOpen={report.id === focusId || reports.length === 1}
            />
          ))}
        </div>
      ) : (
        <div className="sd-fb-empty">
          <span className="sd-fb-empty-icon"><FileText size={24} /></span>
          <h3>No feedback yet — and that's normal</h3>
          <p>
            After an interview, your coaching notes appear here once the placement team has reviewed
            them. Until then, the best preparation is practising what these companies actually ask.
          </p>
          <button type="button" className="sd-btn-primary" onClick={onPractice}>
            Practice questions from your companies
          </button>
        </div>
      )}
    </div>
  );
}

function StudentPracticeView({ token }) {
  return (
    <div className="sd-practice">
      <div className="sd-view-head">
        <h2>Practice questions</h2>
        <p>Real questions asked in real interviews across every company on RSA. The more often one shows up, the more likely you'll be asked it.</p>
      </div>
      <PracticeBank token={token} />
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// Map an application to the student-facing stage bucket + pill.
function studentStatusInfo(app) {
  // The backend derives the single student-facing outcome (and hides sensitive
  // states like waitlist). Prefer it; fall back to raw status for old payloads.
  const raw = String(app.status || app.current_status || "").toUpperCase();
  switch (app.student_outcome) {
    case "declined":
      return { key: "declined", label: "Not interested", cls: "muted" };
    case "interviewing":
      return { key: "interviewing", label: "Interview in progress", cls: "warn" };
    case "interview_done":
      return { key: "interviewing", label: "Interview done · awaiting result", cls: "warn" };
    case "not_attended":
      return { key: "not_shortlisted", label: "Interview not attended", cls: "bad" };
    case "shortlisted":
      return { key: "shortlisted", label: "Shortlisted", cls: "good" };
    case "selected":
      return { key: "shortlisted", label: raw === "JOINED" ? "Joined" : "Selected", cls: "good" };
    case "not_shortlisted":
      return { key: "not_shortlisted", label: "Not shortlisted", cls: "bad" };
    case "pending":
      return { key: "applied", label: "Applied", cls: "neutral" };
    default:
      break;
  }
  if (app.is_interested === false || raw === "DROPPED" || raw === "NOT_INTERESTED")
    return { key: "declined", label: "Not interested", cls: "muted" };
  if (raw.includes("INTERVIEW")) return { key: "interviewing", label: "Interview in progress", cls: "warn" };
  if (raw === "SHORTLISTED") return { key: "shortlisted", label: "Shortlisted", cls: "good" };
  if (["SELECTED", "JOINED", "OFFER_ACCEPTED", "OFFER_RELEASED", "OFFER_PENDING"].includes(raw))
    return { key: "shortlisted", label: raw === "JOINED" ? "Joined" : "Selected", cls: "good" };
  return { key: "applied", label: "Applied", cls: "neutral" };
}

const SD_GROUPS = [
  { key: "interviewing", title: "Interviewing", chipLabel: "Now", chipCls: "warn", sub: "feedback may be ready" },
  { key: "shortlisted", title: "Shortlisted", chipLabel: "Good news", chipCls: "good", sub: "companies want to talk to you" },
  { key: "applied", title: "Applied · waiting to hear back", chipLabel: "Waiting", chipCls: "neutral", sub: "companies" },
  { key: "not_shortlisted", title: "Not shortlisted", chipLabel: "Closed", chipCls: "bad", sub: "profile wasn't taken forward — read the note and update" },
  { key: "declined", title: "Not interested", chipLabel: "Closed", chipCls: "muted", sub: "you declined" },
];

function StudentDashboard({ student, token, onLogout, route = [], navigate = () => {} }) {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  // #/student/feedback and #/student/practice survive a refresh.
  const view =
    route[1] === "feedback" ? "reports" : route[1] === "practice" ? "practice" : "dashboard";
  const setView = useCallback(
    (next) => {
      const seg = next === "reports" ? "feedback" : next === "practice" ? "practice" : "";
      navigate(["student", seg]);
    },
    [navigate],
  );
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [focusReportId, setFocusReportId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({ interviewing: true, shortlisted: true, applied: false, declined: false });

  useEffect(() => {
    let isCurrent = true;
    setLoadingDashboard(true);
    setDashboardError("");
    apiRequest("/students/me/dashboard", { token })
      .then((data) => {
        if (isCurrent) setDashboard(data);
      })
      .catch((err) => {
        if (isCurrent) setDashboardError(err.message);
      })
      .finally(() => {
        if (isCurrent) setLoadingDashboard(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token]);

  // Published reports drive both the Feedback column and the reports view.
  useEffect(() => {
    let isCurrent = true;
    setLoadingReports(true);
    apiRequest("/students/me/reports", { token })
      .then((data) => {
        if (isCurrent) setReports(data || []);
      })
      .catch(() => {
        if (isCurrent) setReports([]);
      })
      .finally(() => {
        if (isCurrent) setLoadingReports(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [token]);

  const reportByApplication = useMemo(() => {
    const map = {};
    reports.forEach((report) => {
      if (report.application_id) map[report.application_id] = report;
    });
    return map;
  }, [reports]);

  function openReport(reportId) {
    setFocusReportId(reportId);
    setView("reports");
  }

  const initials = useMemo(() => {
    return (student.name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [student.name]);
  const firstName = (student.name || "there").split(" ")[0];

  const summary = dashboard?.summary || {};
  const applications = dashboard?.applications || [];
  const shortlisted = dashboard?.shortlisted_applications || [];
  const newestReport = reports[0];

  const groups = useMemo(() => {
    const buckets = { interviewing: [], shortlisted: [], applied: [], not_shortlisted: [], declined: [] };
    applications.forEach((app) => {
      const info = studentStatusInfo(app);
      (buckets[info.key] || buckets.applied).push(app);
    });
    return buckets;
  }, [applications]);

  const stages = [
    { key: "applied", label: "Applied", count: groups.applied.length, note: "waiting", color: "#98a2b3" },
    { key: "shortlisted", label: "Shortlisted", count: groups.shortlisted.length, note: "want to talk", color: "#0f766e" },
    { key: "interviewing", label: "Interviewing", count: groups.interviewing.length, note: "in progress", color: "#f79009" },
    { key: "feedback", label: "Feedback ready", count: reports.length, note: "to read", color: "#12b76a" },
  ];

  const headerSub = shortlisted.length
    ? `${shortlisted.length} ${shortlisted.length === 1 ? "company has" : "companies have"} shortlisted you${reports.length ? ", and you have new coaching feedback." : "."}`
    : "Here's where your applications stand.";

  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function AppCard({ app }) {
    const info = studentStatusInfo(app);
    const opp = app.opportunity || {};
    const report = reportByApplication[app.id];
    const links = [
      ["Resume", app.resume_link, FileText],
      ["Project", app.project_link, Code],
      ["GitHub", app.github_link, Github],
    ].filter(([, href]) => Boolean(href));
    const meta = [
      opp.location,
      opp.stipend ? `Stipend ${opp.stipend}` : null,
      opp.duration,
      app.applied_at ? `Applied ${formatDate(app.applied_at)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className="sd-app">
        <div className="sd-app-top">
          <div className="sd-app-info">
            <div className="sd-app-title">
              <strong>{app.company?.name || "Company"}</strong>
              <span className={`sd-pill ${info.cls}`}>{info.label}</span>
            </div>
            <p className="sd-app-role">
              {opp.role || "Role not mapped"}
              {opp.tech_stack || opp.must_have_skills ? ` · ${opp.tech_stack || opp.must_have_skills}` : ""}
            </p>
            {meta ? <p className="sd-app-meta">{meta}</p> : null}
          </div>
          <div className="sd-app-actions">
            {links.length ? (
              <div className="sd-links">
                {links.map(([label, href, Icon]) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer" title={label}>
                    <Icon size={17} />
                  </a>
                ))}
              </div>
            ) : null}
            {report ? (
              <button type="button" className="sd-read-fb" onClick={() => openReport(report.id)}>
                <FileText size={14} /> Read feedback
              </button>
            ) : null}
          </div>
        </div>
        {app.screening_remark ? (
          <div className="sd-remark">
            <AlertCircle size={15} />
            <p><strong>Note from the company</strong> — {app.screening_remark}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="dashboard-shell sd-shell">
      <aside className="sidebar">
        <div className="side-brand">
          <ShieldCheck size={22} />
          <span>RSA</span>
        </div>
        <nav>
          <button type="button" className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <BarChart3 size={18} /> Dashboard
          </button>
          <button
            type="button"
            className={view === "reports" ? "active" : ""}
            onClick={() => {
              setFocusReportId(null);
              setView("reports");
            }}
          >
            <FileText size={18} /> Interview feedback
            {reports.length ? <span className="nav-count">{reports.length}</span> : null}
          </button>
          <button type="button" className={view === "practice" ? "active" : ""} onClick={() => setView("practice")}>
            <BookOpenCheck size={18} /> Practice questions
          </button>
        </nav>
        <div className="sd-side-foot">
          {shortlisted.length ? (
            <p className="sd-nudge">You're on {shortlisted.length} shortlist{shortlisted.length === 1 ? "" : "s"}. Keep the momentum going.</p>
          ) : null}
          <button className="ghost-button" onClick={onLogout}>
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="topbar sd-topbar">
          <div>
            <p className="eyebrow">Student dashboard</p>
            <h1>{greeting()}, {firstName} 👋</h1>
            <p className="sd-header-sub">{headerSub}</p>
          </div>
          <div className="sd-profile-wrap">
            <button type="button" className="sd-profile-btn" onClick={() => setProfileOpen((v) => !v)}>
              <span className="avatar">{initials}</span>
              <span className="sd-profile-name">{firstName}</span>
              <ChevronDown size={16} />
            </button>
            {profileOpen ? (
              <div className="sd-profile-menu">
                <p className="sd-profile-eyebrow">Your profile</p>
                <div className="sd-profile-list">
                  <div><span>Phone</span><strong>{student.phone || "—"}</strong></div>
                  <div><span>Email</span><strong>{student.email || "—"}</strong></div>
                  <div><span>Stack</span><strong>{student.stack || "To be mapped"}</strong></div>
                  <div>
                    <span>Resume</span>
                    {student.resume_link ? (
                      <a href={student.resume_link} target="_blank" rel="noreferrer">View resume</a>
                    ) : (
                      <strong>Not added</strong>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {view === "reports" ? (
          <StudentReportsView reports={reports} loading={loadingReports} focusId={focusReportId} onPractice={() => setView("practice")} />
        ) : view === "practice" ? (
          <StudentPracticeView token={token} />
        ) : dashboardError ? (
          <StatusMessage error={dashboardError} />
        ) : loadingDashboard ? (
          <PanelLoader />
        ) : (
          <>
            <section className="sd-stage-bar">
              <div className="sd-stage-head">
                <h2>Where your {applications.length} application{applications.length === 1 ? "" : "s"} stand</h2>
                <span>Tap a stage to jump to it</span>
              </div>
              <div className="sd-stages">
                {stages.map((stage) => (
                  <button
                    type="button"
                    key={stage.key}
                    className={`sd-stage ${stage.key !== "feedback" && openGroups[stage.key] ? "on" : ""}`}
                    onClick={() => (stage.key === "feedback" ? setView("reports") : toggleGroup(stage.key))}
                  >
                    <span className="sd-stage-label">
                      <i style={{ background: stage.color }} /> {stage.label}
                    </span>
                    <span className="sd-stage-count">
                      <strong>{stage.count}</strong> {stage.note}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <div className="sd-grid">
              <section className="sd-groups">
                {applications.length ? (
                  SD_GROUPS.map((g) => {
                    const items = groups[g.key];
                    if (!items.length) return null;
                    const open = openGroups[g.key];
                    return (
                      <div className="sd-group" key={g.key}>
                        <button type="button" className="sd-group-head" onClick={() => toggleGroup(g.key)}>
                          <span className={`sd-chip ${g.chipCls}`}>{g.chipLabel}</span>
                          <span className="sd-group-title">{g.title}</span>
                          <span className="sd-group-sub">{items.length} {g.sub}</span>
                          <span className="sd-caret">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                        </button>
                        {open ? (
                          <div className="sd-group-body">
                            {items.map((app) => <AppCard key={app.id} app={app} />)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state"><p>No applications yet.</p></div>
                )}
              </section>

              <aside className="sd-side">
                {newestReport ? (
                  <>
                    <div className="sd-coach">
                      <div className="sd-coach-head">
                        <div className="sd-coach-eyebrow"><Sparkles size={14} /> New coaching feedback</div>
                        <h3>{newestReport.company?.name || "Company"}</h3>
                        <p>{newestReport.opportunity?.role || "Role"}{newestReport.generated_at ? ` · ${formatDate(newestReport.generated_at)}` : ""}</p>
                      </div>
                      <div className="sd-coach-body">
                        {newestReport.overall?.summary ? <p className="sd-coach-summary">{newestReport.overall.summary}</p> : null}
                        <div className="sd-mini-skills">
                          {Object.entries(newestReport.skill_ratings || {}).slice(0, 3).map(([name, rating]) => (
                            <div className="sd-mini-skill" key={name}>
                              <span>{name}</span>
                              <span className="sd-mini-bar"><i style={{ width: `${((rating || 0) / 5) * 100}%` }} /></span>
                              <b>{rating ?? "–"}/5</b>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="sd-btn-primary" onClick={() => openReport(newestReport.id)}>Read the full feedback</button>
                      </div>
                    </div>

                    {newestReport.improvements?.length ? (
                      <div className="sd-card">
                        <p className="sd-card-eyebrow">Fix these first</p>
                        <div className="sd-fix-list">
                          {newestReport.improvements.slice(0, 3).map((imp, i) => (
                            <div className="sd-fix" key={i}>
                              <span className={`sd-prio ${imp.priority}`}>{imp.priority === "high" ? "High" : imp.priority === "medium" ? "Med" : imp.priority}</span>
                              <span>{imp.area}</span>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="sd-btn-soft" onClick={() => setView("practice")}>Practice what you missed</button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="sd-card">
                    <p className="sd-card-eyebrow">Interview coaching</p>
                    <p className="sd-empty-note">No feedback yet — once you interview, your coaching appears here. Until then, practice what your companies ask.</p>
                    <button type="button" className="sd-btn-soft" onClick={() => setView("practice")}>Practice questions</button>
                  </div>
                )}

                <div className="sd-card">
                  <div className="sd-card-head">
                    <p className="sd-card-eyebrow">Interview ready</p>
                    <span className="sd-card-count">{shortlisted.length}</span>
                  </div>
                  {shortlisted.length ? (
                    <div className="sd-ready-list">
                      {shortlisted.slice(0, 5).map((app) => (
                        <div className="sd-ready" key={app.id}>
                          <span className="sd-ready-info">
                            <strong>{app.company?.name || "Company"}</strong>
                            <span>{app.opportunity?.role || "Role"}</span>
                          </span>
                          <span className="sd-ready-date">{app.applied_at ? formatDate(app.applied_at) : ""}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="sd-empty-note">Shortlists will appear here.</p>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Skeleton({ w = "100%", h = 12, r = 6, style }) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// A shimmer skeleton stands in for content while it loads — used everywhere in
// place of a spinner so the layout doesn't jump when data arrives.
function PanelLoader({ rows = 6 }) {
  return (
    <div className="skeleton-list" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <Skeleton w={22} h={22} r={6} />
          <span className="skeleton-lines">
            <Skeleton w="38%" h={13} />
            <Skeleton w="58%" h={10} />
          </span>
          <Skeleton w={64} h={26} r={8} />
        </div>
      ))}
    </div>
  );
}

function statusClass(status) {
  const s = (status || "").toLowerCase();
  if (["shortlisted", "hired", "selected", "joined", "offer_accepted"].includes(s)) return "good";
  if (["rejected", "not_shortlisted", "dropped", "not_interested", "offer_rejected"].includes(s)) return "bad";
  if (s.includes("interview") || s === "in_progress") return "warn";
  return "neutral";
}

function formatStatus(status) {
  return (status || "applied").replaceAll("_", " ");
}

function getLinkIcon(label) {
  if (label?.toLowerCase() === "resume") return <FileText size={18} />;
  if (label?.toLowerCase() === "github") return <Github size={18} />;
  if (label?.toLowerCase() === "project") return <Code size={18} />;
  return <ExternalLink size={18} />;
}

function companyStatusClass(value) {
  const status = (value || "").toLowerCase();
  if (status.includes("hired") && !status.includes("not")) return "good";
  if (status.includes("progress")) return "warn";
  if (status.includes("not hired") || status.includes("reject") || status.includes("drop")) return "bad";
  return "neutral";
}

function ApplicationMini({ application }) {
  return (
    <div className="shortlist-item">
      <div>
        <strong>{application.company?.name || "Company"}</strong>
        <span>{application.opportunity?.role || "Role not mapped"}</span>
      </div>
      <span className={`status-pill ${statusClass(application.status)}`}>{formatStatus(application.status)}</span>
    </div>
  );
}

function ApplicationRow({ application, report, onOpenReport }) {
  const links = [
    ["Resume", application.resume_link],
    ["Project", application.project_link],
    ["GitHub", application.github_link],
  ].filter(([, href]) => Boolean(href));

  return (
    <div className="applications-row">
      <div>
        <strong>{application.company?.name || "Company"}</strong>
        <span>{application.opportunity?.location || "Location not added"}</span>
      </div>
      <div>
        <strong>{application.opportunity?.role || "Role not mapped"}</strong>
        <span>{application.opportunity?.tech_stack || application.opportunity?.must_have_skills || "Skills not mapped"}</span>
      </div>
      <div>
        <span className={`status-pill ${statusClass(application.status)}`}>{formatStatus(application.status)}</span>
        <span className="date-line">
          <CalendarClock size={14} />
          {application.applied_at ? new Date(application.applied_at).toLocaleDateString() : "Date not added"}
        </span>
        {application.screening_remark ? (
          <span
            className={`screening-note ${application.screening_decision === "shortlisted" ? "good" : ""}`}
            title={application.screening_remark}
          >
            {application.screening_decision === "not_shortlisted" ? "Feedback: " : ""}
            {application.screening_remark}
          </span>
        ) : null}
      </div>
      <div className="link-group">
        {links.length ? (
          links.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" title={label} className="icon-link">
              {getLinkIcon(label)}
            </a>
          ))
        ) : (
          <span className="muted">No links</span>
        )}
      </div>
      {onOpenReport ? (
        <div>
          {report ? (
            <button type="button" className="rsa-feedback-btn" onClick={() => onOpenReport(report.id)}>
              <FileText size={15} />
              View feedback
              <span className="rsa-mini-score">{report.overall?.score ?? "–"}/10</span>
            </button>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AdminDashboard({ adminToken, onLogout, route = [], navigate = () => {} }) {
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  // Navigation lives in the URL: #/admin, #/admin/students,
  // #/admin/company/<id>[/opp/<id>]. A refresh therefore lands where you were.
  const KNOWN_VIEWS = ["students", "analytics", "student", "company", "reports"];
  const activeView = KNOWN_VIEWS.includes(route[1]) ? route[1] : "overview";
  const companyId = route[1] === "company" ? route[2] || null : null;
  const studentId = route[1] === "student" ? route[2] || null : null;
  const routeOppId = route[3] === "opp" ? route[4] || null : null;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [filterByRole, setFilterByRole] = useState("all");

  function loadDashboard() {
    setLoading(true);
    setError("");
    apiRequest("/admin/dashboard", { adminToken })
      .then(setDashboard)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function loadStudents() {
    setLoadingStudents(true);
    setError("");
    apiRequest("/admin/students", { adminToken })
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingStudents(false));
  }

  function openStudentsView() {
    navigate(["admin", "students"]);
  }

  function openCompany(company) {
    if (!company?.id) return;
    navigate(["admin", "company", company.id]);
  }

  function backToOverview() {
    navigate(["admin"]);
  }

  useEffect(() => {
    loadDashboard();
  }, [adminToken]);

  // Deep-linking straight to #/admin/students needs the list fetched too.
  useEffect(() => {
    if (activeView === "students" && !students.length && !loadingStudents) loadStudents();
  }, [activeView]);

  const summary = dashboard?.summary || {};
  const recentOpportunities = dashboard?.recent_opportunities || [];
  const funnel = dashboard?.funnel || [];
  const loss = dashboard?.loss || {};
  const actionCenter = dashboard?.action_center || {};
  const actionTotal = dashboard?.action_total ?? 0;
  const placement = dashboard?.placement || {};
  const reportsSummary = dashboard?.reports_summary || {};

  // Filter opportunities based on search term and role filter
  const filteredOpportunities = recentOpportunities.filter((opp) => {
    const matchesSearch = (opp.company?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterByRole === "all" || (opp.role || "").toLowerCase() === filterByRole.toLowerCase();
    return matchesSearch && matchesRole;
  });

  // Sort opportunities
  const sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
    if (sortBy === "recent") {
      const dateA = new Date(a.opportunity_received_at || 0).getTime();
      const dateB = new Date(b.opportunity_received_at || 0).getTime();
      return dateB - dateA;
    } else if (sortBy === "oldest") {
      const dateA = new Date(a.opportunity_received_at || 0).getTime();
      const dateB = new Date(b.opportunity_received_at || 0).getTime();
      return dateA - dateB;
    } else if (sortBy === "applied_asc") {
      return (a.application_count ?? 0) - (b.application_count ?? 0);
    } else if (sortBy === "applied_desc") {
      return (b.application_count ?? 0) - (a.application_count ?? 0);
    } else if (sortBy === "shortlisted_asc") {
      return (a.shortlisted_count ?? 0) - (b.shortlisted_count ?? 0);
    } else if (sortBy === "shortlisted_desc") {
      return (b.shortlisted_count ?? 0) - (a.shortlisted_count ?? 0);
    } else if (sortBy === "response_asc") {
      return (a.response_count ?? 0) - (b.response_count ?? 0);
    } else if (sortBy === "response_desc") {
      return (b.response_count ?? 0) - (a.response_count ?? 0);
    }
    return 0;
  });

  const overviewViews = ["overview", "queue", "companies", "reports"];
  return (
    <main className="dashboard-shell sd-shell">
      <aside className="sidebar">
        <div className="side-brand">
          <ShieldCheck size={22} />
          <span>RSA Admin</span>
        </div>
        <nav>
          <button className={activeView === "overview" ? "active" : ""} type="button" onClick={backToOverview}>
            <BarChart3 size={18} /> Overview
          </button>
          <button className={activeView === "students" ? "active" : ""} type="button" onClick={openStudentsView}>
            <UsersRound size={18} /> Students
          </button>
          <button className={activeView === "reports" ? "active" : ""} type="button" onClick={() => navigate(["admin", "reports"])}>
            <FileText size={18} /> Interview reports
            {reportsSummary.pending ? <span className="side-badge warn">{reportsSummary.pending}</span> : null}
          </button>
          <button className={activeView === "analytics" ? "active" : ""} type="button" onClick={() => navigate(["admin", "analytics"])}>
            <TrendingUp size={18} /> Analytics
          </button>
        </nav>
        <div className="side-foot">
          {actionCenter.missing_shortlist_data ? (
            <p className="side-nudge">{actionCenter.missing_shortlist_data} openings are missing shortlist data — the biggest blind spot in the funnel.</p>
          ) : null}
          <button className="ghost-button" onClick={onLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        {activeView === "student" ? (
          <StudentProfileView
            adminToken={adminToken}
            studentId={studentId}
            navigate={navigate}
            onBack={() => window.history.back()}
          />
        ) : activeView === "company" ? (
          <CompanyDetailView
            adminToken={adminToken}
            companyId={companyId}
            onBack={backToOverview}
            selectedOppId={routeOppId}
            onSelectOpp={(oppId) =>
              navigate(oppId ? ["admin", "company", companyId, "opp", oppId] : ["admin", "company", companyId])
            }
            onDataChanged={loadDashboard}
          />
        ) : (
        <>
        {error ? <StatusMessage error={error} /> : null}

        {activeView === "analytics" ? (
          <>
            <header className="topbar">
              <div><p className="eyebrow">Admin Dashboard</p><h1>Analytics</h1></div>
            </header>
            <AdminAnalyticsView adminToken={adminToken} navigate={navigate} />
          </>
        ) : activeView === "students" ? (
          <>
            <header className="topbar">
              <div><p className="eyebrow">Admin Dashboard</p><h1>Students</h1></div>
              <button className="icon-button" type="button" onClick={loadStudents} disabled={loadingStudents} title="Refresh">
                <RefreshCw className={loadingStudents ? "spin" : ""} size={18} />
              </button>
            </header>
            <AdminStudentsView students={students} loading={loadingStudents} navigate={navigate} />
          </>
        ) : activeView === "reports" ? (
          <AdminReportsView adminToken={adminToken} reportsSummary={reportsSummary} navigate={navigate} />
        ) : (
          <AdminOverview
            loading={loading}
            summary={summary}
            funnel={funnel}
            loss={loss}
            actionCenter={actionCenter}
            placement={placement}
            reportsSummary={reportsSummary}
            recentOpportunities={sortedOpportunities}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
            adminToken={adminToken}
            onRefresh={loadDashboard}
            openCompany={openCompany}
            navigate={navigate}
          />
        )}
        </>
        )}
      </section>
    </main>
  );
}

/* --------------------------- Admin Overview --------------------------- */

function LossItem({ label, n, applied, color, note, pending }) {
  const pct = applied ? Math.round((n / applied) * 100) : 0;
  return (
    <div className={`ov-loss-item${pending ? " pending" : ""}`}>
      <div className="ov-loss-top">
        <span>{label}</span>
        {pending ? (
          <span className="ov-loss-pill">tracked per application</span>
        ) : (
          <span className="ov-loss-n"><strong>{fmt(n)}</strong><span>{pct}%</span></span>
        )}
      </div>
      {!pending ? (
        <div className="ov-loss-bar"><div style={{ width: `${Math.max(pct, 1)}%`, background: color }} /></div>
      ) : null}
      <p className="ov-loss-note">{note}</p>
    </div>
  );
}

function ShortlistCell({ applied, shortlisted }) {
  if (shortlisted > 0) {
    const pct = applied ? Math.round((shortlisted / applied) * 100) : 0;
    return <span className="ov-sl good">{shortlisted}<span className="ov-sl-pct"> · {pct}%</span></span>;
  }
  if (!applied) return <span className="ov-sl none">no data</span>;
  return <span className="ov-sl zero">0</span>;
}

function AdminComingSoon({ title, eyebrow = "Admin Dashboard", subtitle, note, onBack }) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {subtitle ? <p className="ov-sub">{subtitle}</p> : null}
        </div>
      </header>
      <div className="ov-card ov-soon">
        <ListChecks size={26} />
        <h2>{title} — coming next</h2>
        {note ? <p>{note}</p> : null}
        <button type="button" className="sd-btn-soft" style={{ maxWidth: 220 }} onClick={onBack}>← Back to Overview</button>
      </div>
    </>
  );
}

function ReportRow({ report, open, onToggle, onPublish, busy }) {
  return (
    <div className={`rep-item ${open ? "open" : ""}`}>
      <div className="rep-row" onClick={onToggle}>
        <span className="rep-caret">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
        <span className="rep-main">
          <strong>{report.student?.name || "Student"}</strong>
          <span className="rep-sub">{report.company || "Company"} · {report.role || "—"}{report.overall?.score != null ? ` · ${report.overall.score}/10` : ""}</span>
        </span>
        <span className={`vis-badge ${report.visible_to_student ? "on" : ""}`}>{report.visible_to_student ? "Shared" : "Pending"}</span>
        <span className="rep-date">{formatDate(report.generated_at)}</span>
        <button
          type="button"
          className={`rep-pub ${report.visible_to_student ? "unpub" : "pub"}`}
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); onPublish(); }}
        >
          {busy ? "…" : report.visible_to_student ? "Unpublish" : "Publish"}
        </button>
      </div>
      {open ? <div className="rep-body"><AdminInterviewReportCard report={report} /></div> : null}
    </div>
  );
}

function AdminReportsView({ adminToken, reportsSummary = {} }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [openCompany, setOpenCompany] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState([]);
  const [gen, setGen] = useState(null); // {done,total,current} while generating
  const [genOne, setGenOne] = useState(null); // session id being (re)generated on its own
  const [filter, setFilter] = useState("all"); // all | pending | published (report publish state)
  const [showPending, setShowPending] = useState(false); // reveal the pending-extractions list

  function load() {
    setLoading(true);
    setError("");
    apiRequest("/admin/reports", { adminToken })
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  function loadPending() {
    apiRequest("/admin/sessions/pending", { adminToken })
      .then((d) => setPending(Array.isArray(d) ? d : []))
      .catch(() => {});
  }
  useEffect(() => { load(); loadPending(); }, [adminToken]);

  async function togglePublish(report) {
    setBusyId(report.id);
    try {
      await apiRequest(`/admin/reports/${report.id}/visibility`, {
        method: "PATCH",
        adminToken,
        body: { visible_to_student: !report.visible_to_student },
      });
      setReports((rs) => rs.map((r) => (r.id === report.id ? { ...r, visible_to_student: !r.visible_to_student } : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // Analyse each pending session one at a time (avoids server timeout + bursting
  // the AI quota). Stops on the first failure with a clear message.
  async function generatePending() {
    if (!pending.length || gen) return;
    setError("");
    const list = [...pending];
    for (let i = 0; i < list.length; i++) {
      setGen({ done: i, total: list.length, current: list[i].company });
      try {
        await apiRequest(`/interview-sessions/${list[i].id}/analyze`, { method: "POST", adminToken });
      } catch (e) {
        setError(`Stopped at ${list[i].company}: ${e.message}`);
        break;
      }
    }
    setGen(null);
    load();
    loadPending();
  }

  // Resume / regenerate ONE half-finished extraction (analyse is idempotent —
  // it overwrites that session's reports & questions, completing what's missing).
  async function generateOne(session) {
    if (gen || genOne) return;
    setGenOne(session.id);
    setError("");
    try {
      await apiRequest(`/interview-sessions/${session.id}/analyze`, { method: "POST", adminToken });
    } catch (e) {
      setError(`Failed for ${session.company}: ${e.message}`);
    } finally {
      setGenOne(null);
      load();
      loadPending();
    }
  }

  const pendingReports = reports.filter((r) => !r.visible_to_student).length;

  // Reports grouped by company, filtered by publish state (All / Pending / Published).
  const companies = useMemo(() => {
    const src =
      filter === "pending" ? reports.filter((r) => !r.visible_to_student)
      : filter === "published" ? reports.filter((r) => r.visible_to_student)
      : reports;
    const map = {};
    src.forEach((r) => {
      const key = r.company || "Company";
      if (!map[key]) map[key] = { company: key, expectations: null, focus: [], reports: [] };
      map[key].reports.push(r);
      if (!map[key].expectations && r.company_expectations?.expectations) {
        map[key].expectations = r.company_expectations.expectations;
        map[key].focus = r.company_expectations.focus || [];
      }
    });
    return Object.values(map).sort((a, b) => b.reports.length - a.reports.length);
  }, [reports, filter]);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Interview reports</h1>
          <p className="ov-sub">
            {reportsSummary.published ?? 0} of {reportsSummary.reports ?? reports.length} published ·{" "}
            <button type="button" className="link-button" onClick={() => setFilter("pending")}>
              {reportsSummary.pending ?? pendingReports} pending
            </button>
          </p>
        </div>
        <div className="rep-head-actions">
          {pending.length ? (
            <button type="button" className="rep-generate" onClick={generatePending} disabled={!!gen}>
              <Sparkles size={16} />
              {gen ? `Generating ${gen.done + 1}/${gen.total}…` : `Generate reports (${pending.length})`}
            </button>
          ) : null}
          <button className="icon-button" type="button" onClick={() => { load(); loadPending(); }} disabled={loading || !!gen} title="Refresh">
            <RefreshCw className={loading ? "spin" : ""} size={18} />
          </button>
        </div>
      </header>

      {gen ? <p className="range-note">Analysing {gen.current} — {gen.done + 1} of {gen.total}. Keep this tab open; this can take a while.</p> : null}
      {error ? <StatusMessage error={error} /> : null}

      {/* Half-finished / not-yet-run transcript extractions: resume each on its own. */}
      {pending.length ? (
        <div className="rep-pending-box">
          <button type="button" className="rep-pending-head" onClick={() => setShowPending((v) => !v)}>
            {showPending ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {pending.length} transcript{pending.length === 1 ? "" : "s"} awaiting extraction — resume or regenerate individually
          </button>
          {showPending ? (
            <div className="rep-pending-list">
              {pending.map((s) => (
                <div className="rep-pending-item" key={s.id}>
                  <div className="rep-pending-main">
                    <strong>{s.company}</strong>
                    <span>{[s.role, `${s.students} candidate${s.students === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</span>
                  </div>
                  <button type="button" className="rep-generate small" onClick={() => generateOne(s)} disabled={!!gen || !!genOne}>
                    {genOne === s.id ? <><Loader2 className="spin" size={14} /> Generating…</> : <><Sparkles size={14} /> Generate</>}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && reports.length ? (
        <div className="rep-subtabs">
          <button type="button" className={`rep-chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>
            All ({reports.length})
          </button>
          <button type="button" className={`rep-chip ${filter === "pending" ? "on" : ""}`} onClick={() => setFilter("pending")}>
            Pending ({pendingReports})
          </button>
          <button type="button" className={`rep-chip ${filter === "published" ? "on" : ""}`} onClick={() => setFilter("published")}>
            Published ({reports.length - pendingReports})
          </button>
        </div>
      ) : null}

      {loading ? (
        <PanelLoader />
      ) : !companies.length ? (
        <div className="empty-state compact">
          <p>
            {filter === "pending" ? "No pending reports — everything is published."
              : filter === "published" ? "No published reports yet."
              : "No interview reports yet."}
          </p>
        </div>
      ) : (
        <div className="rep-list" data-scroll-key="reports">
          {companies.map((c) => (
            <div className={`rep-item ${openCompany === c.company ? "open" : ""}`} key={c.company}>
              <div className="rep-row" onClick={() => setOpenCompany(openCompany === c.company ? null : c.company)}>
                <span className="rep-caret">{openCompany === c.company ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                <span className="rep-main">
                  <strong>{c.company}</strong>
                  <span className="rep-sub">{c.reports.length} candidate{c.reports.length === 1 ? "" : "s"}{c.expectations ? " · RSA ready" : ""}</span>
                </span>
                <span className="rep-date">{c.reports.length}</span>
              </div>
              {openCompany === c.company ? (
                <div className="rep-body">
                  {c.expectations ? (
                    <div className="report-sec report-expects">
                      <strong>What this company looked for</strong>
                      <p>{c.expectations}</p>
                      {c.focus.length ? <div className="report-focus">{c.focus.map((f, i) => <span key={i} className="report-focus-chip">{f}</span>)}</div> : null}
                    </div>
                  ) : (
                    <p className="ov-muted" style={{ marginTop: 0 }}>Company summary not generated yet — run “Generate reports”.</p>
                  )}
                  <div className="rsa-candidates">
                    {c.reports.map((r) => (
                      <ReportRow
                        key={r.id}
                        report={r}
                        open={openId === r.id}
                        onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                        onPublish={() => togglePublish(r)}
                        busy={busyId === r.id}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AdminOverview({
  loading, summary, funnel, loss, actionCenter, placement, reportsSummary,
  recentOpportunities, searchTerm, setSearchTerm, sortBy, setSortBy,
  adminToken, onRefresh, openCompany, navigate,
}) {
  const [openingsOpen, setOpeningsOpen] = useState(true);
  const applied = funnel[0]?.n || 0;
  const stageColor = { interviewing: "#d97706", placed: "#166534" };
  const actionRows = [
    { key: "missing_shortlist_data", label: "Openings missing shortlist data", tone: "teal", to: null },
    { key: "profiles_requested_not_shared", label: "Profiles requested but not shared", tone: "teal", to: null },
    { key: "reports_unpublished", label: "Interview reports not yet published", tone: "warn", to: ["admin", "reports"] },
    { key: "interviewed_no_report", label: "Interviewed but no report generated", tone: "teal", to: ["admin", "reports"] },
    { key: "inactive_30d", label: "Students inactive 30+ days", tone: "bad", to: ["admin", "students"] },
  ];
  return (
    <div className="ov">
      <header className="ov-head">
        <div>
          <p className="eyebrow">Admin dashboard</p>
          <h1>Placement pipeline</h1>
          <p className="ov-sub">
            {placement.rate ?? 0}% placed · {placement.placed ?? 0} of {placement.total_students ?? 0} students · {fmt(summary.response_count)} applications across {fmt(summary.total_opportunities)} openings
          </p>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh">
          <RefreshCw className={loading ? "spin" : ""} size={18} />
        </button>
      </header>

      <AddCompaniesPanel adminToken={adminToken} onImported={onRefresh} />

      {/* <section className="ov-card">
        <div className="ov-card-head">
          <div>
            <h2>Where the {fmt(applied)} applications stand</h2>
            <p className="ov-muted">Every stage shows its share of all applications and the drop from the stage above it.</p>
          </div>
        </div>
        <div className="ov-funnel">
          {funnel.map((s, i) => {
            const pct = applied ? (s.n / applied) * 100 : 0;
            const prev = funnel[i - 1];
            const lost = prev ? prev.n - s.n : 0;
            const dropPct = applied ? Math.round((lost / applied) * 100) : 0;
            const color = stageColor[s.key] || "#0f766e";
            return (
              <React.Fragment key={s.key}>
                {prev && lost > 0 ? (
                  <div className="ov-funnel-drop"><span className="ov-drop">↓ {fmt(lost)} dropped off · −{dropPct}%</span></div>
                ) : null}
                <div className="ov-funnel-row">
                  <div className="ov-funnel-label"><span>{s.label}</span><span className="ov-muted-xs">{s.sub}</span></div>
                  <div className="ov-bar"><div style={{ width: `${Math.max(pct, 1.5)}%`, background: color }} /></div>
                  <div className="ov-funnel-val"><strong>{fmt(s.n)}</strong><span>{pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%</span></div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <p className="ov-foot">Interested is derived from the opt-in rate on dated applications; Selected / joined covers offer-accepted, selected and joined since they aren't stored separately.</p>
      </section> */}

      <div className="">
        <section className="ov-card">
          <h2>Where we lose people</h2>
          <p className="ov-muted">Slices of the {fmt(applied)} applications. Neither is a rejection, and they can overlap.</p>
          <div className="ov-loss">
            <LossItem label="Dropped — student declined" n={loss.dropped} applied={applied} color="#94a3b8" note="The student turned the opening down — role fit, location or timing. Worth asking why before mapping them again." />
            <LossItem label="Awaiting company response" n={loss.awaiting} applied={applied} color="#f59e0b" note="Still at Applied with no decision recorded. Stalled, not lost — this is the pile the action queue chases." />
            <LossItem label="Not shortlisted — resume screen" n={loss.not_shortlisted} applied={applied} color="#b42318" note="A resume-stage pass with the company's note attached where they gave one — never a failed interview." />
          </div>
        </section>

        {/* <section className="ov-card">
          <div className="ov-card-head-row">
            <h2>Needs action today</h2>
          </div>
          <div className="ov-actions">
            {actionRows.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`ov-action ${r.to ? "" : "static"}`}
                onClick={() => r.to && navigate(r.to)}
              >
                <span className="ov-action-label">{r.label}</span>
                <span className={`ov-count ${r.tone}`}>{actionCenter[r.key] ?? 0}</span>
                {r.to ? <ChevronRight size={17} className="ov-action-caret" /> : <span className="ov-action-caret" />}
              </button>
            ))}
          </div>
          <div className="ov-mini">
            <div><span className="ov-mini-k">Placed</span><span className="ov-mini-v"><strong>{placement.placed ?? 0}</strong> of {placement.total_students ?? 0}</span></div>
            <div><span className="ov-mini-k">Reports out</span><span className="ov-mini-v"><strong>{reportsSummary.published ?? 0}</strong> of {reportsSummary.reports ?? 0}</span></div>
            <div><span className="ov-mini-k">Questions</span><span className="ov-mini-v"><strong>{fmt(reportsSummary.questions)}</strong> banked</span></div>
          </div>
        </section> */}
      </div>

      <section className="ov-card">
        <button type="button" className="ov-fold" onClick={() => setOpeningsOpen((v) => !v)} aria-expanded={openingsOpen}>
          <h2>Latest openings received</h2>
          {recentOpportunities.length ? <span className="ov-muted">{recentOpportunities.length} of {fmt(summary.total_opportunities)}</span> : null}
          <span className="ov-fold-caret">{openingsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
        </button>
        {openingsOpen ? (
          <>
            {recentOpportunities.length || searchTerm ? (
              <div className="opportunities-controls">
                <div className="search-field">
                  <input type="text" placeholder="Search by company name…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
                </div>
                <div className="controls-row">
                  <div className="sort-controls">
                    <label>Sort by:</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                      <option value="recent">Recent First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="applied_desc">Most Applied</option>
                      <option value="applied_asc">Least Applied</option>
                      <option value="shortlisted_desc">Most Shortlisted</option>
                      <option value="shortlisted_asc">Least Shortlisted</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : null}
            {loading ? (
              <PanelLoader />
            ) : recentOpportunities.length ? (
              <div className="ov-table-scroll" data-scroll-key="ov-openings">
                <div className="ov-table">
                  <div className="ov-thead"><span>Company</span><span>Role</span><span>Applied</span><span>Shortlisted</span><span>Received</span></div>
                  {recentOpportunities.map((o) => (
                    <div className="ov-trow" key={o.id}>
                      <div className="ov-cell">
                        <button type="button" className="link-button" onClick={() => openCompany(o.company)} title="View company detail">{o.company?.name || "Company"}</button>
                        <span>{o.location || "—"}</span>
                      </div>
                      <div className="ov-cell">
                        <strong>{o.role || "Role not mapped"}</strong>
                        <span>{o.tech_stack || o.must_have_skills || "—"}</span>
                      </div>
                      <span className="ov-applied">{o.application_count ?? 0}</span>
                      <ShortlistCell applied={o.application_count ?? 0} shortlisted={o.shortlisted_count ?? 0} />
                      <span className="ov-date">{formatDate(o.opportunity_received_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state compact"><p>{searchTerm ? "No openings match your search." : "No openings yet."}</p></div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}

/* ------------------------------ Analytics ------------------------------ */

const STATUS_META = {
  APPLIED: { label: "Applied", color: "#3b82f6" },
  PROFILE_SHARED: { label: "Profile shared", color: "#6366f1" },
  SHORTLISTED: { label: "Shortlisted", color: "#0f766e" },
  NOT_SHORTLISTED: { label: "Not shortlisted", color: "#b42318" },
  WAITLISTED: { label: "Waitlisted", color: "#7c3aed" },
  INTERVIEW_SCHEDULED: { label: "Interview scheduled", color: "#d97706" },
  INTERVIEW_IN_PROGRESS: { label: "Interview in progress", color: "#f59e0b" },
  INTERVIEW_COMPLETED: { label: "Interview done · awaiting result", color: "#d97706" },
  INTERVIEW_NOT_ATTENDED: { label: "Interview not attended", color: "#b42318" },
  SELECTED: { label: "Selected", color: "#15803d" },
  JOINED: { label: "Joined", color: "#166534" },
  OFFER_PENDING: { label: "Offer pending", color: "#0ea5e9" },
  OFFER_RELEASED: { label: "Offer released", color: "#0ea5e9" },
  OFFER_ACCEPTED: { label: "Offer accepted", color: "#15803d" },
  OFFER_REJECTED: { label: "Offer rejected", color: "#dc2626" },
  REJECTED: { label: "Rejected", color: "#dc2626" },
  DROPPED: { label: "Dropped", color: "#94a3b8" },
};

function statusMeta(key) {
  return STATUS_META[key] || { label: String(key || "Unknown").replace(/_/g, " "), color: "#64748b" };
}

function StatusChip({ status }) {
  const meta = statusMeta(status);
  return (
    <span className="status-chip" style={{ color: meta.color, borderColor: meta.color }}>
      {meta.label}
    </span>
  );
}

function fmt(value) {
  return (value ?? 0).toLocaleString();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shortDate(s) {
  const [, m, d] = String(s).split("-").map(Number);
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m || 1) - 1];
  return `${mo} ${d}`;
}

function presetRange(preset) {
  const now = new Date();
  if (preset === "last_month") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toDateStr(s), end: toDateStr(e) };
  }
  if (preset === "last_30") {
    const s = new Date(now);
    s.setDate(s.getDate() - 29);
    return { start: toDateStr(s), end: toDateStr(now) };
  }
  if (preset === "all_time") {
    return { start: "2026-01-01", end: toDateStr(now) };
  }
  return { start: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), end: toDateStr(now) };
}

// "2026-07" -> { start: "2026-07-01", end: "2026-07-31" }
function monthRangeFromYM(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return { start: `${y}-${pad2(m)}-01`, end: toDateStr(new Date(y, m, 0)) };
}

function monthLabel(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m || 1) - 1];
  return `${mo} ${y}`;
}

// Columns the active-students export can include — one row per UNIQUE student
// (the counts already summarise their applications, so no per-company rows).
const ACTIVE_STUDENT_FIELDS = [
  { key: "external_user_id", label: "Student ID (response sheet)", val: (s) => s.external_user_id || "" },
  { key: "name", label: "Student name", val: (s) => s.name || "" },
  { key: "phone", label: "Mobile number", val: (s) => s.phone || "" },
  { key: "email", label: "Email", val: (s) => s.email || "" },
  { key: "apps", label: "Total applied", val: (s) => s.apps ?? 0 },
  { key: "shortlisted", label: "Total shortlisted", val: (s) => s.shortlisted ?? 0 },
  { key: "not_shortlisted", label: "Total not shortlisted", val: (s) => s.not_shortlisted ?? 0 },
];
const DEFAULT_EXPORT_FIELDS = ["external_user_id", "name", "phone", "email", "apps", "shortlisted"];

// Download rows as a CSV (opens natively in Google Sheets / Excel). A UTF-8 BOM
// keeps names with accents/unicode readable; fields are quote-escaped.
function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DateRangeControl({ preset, range, onPreset, onCustom }) {
  const presets = [
    ["this_month", "This month"],
    ["last_month", "Last month"],
    ["last_30", "Last 30 days"],
    ["all_time", "All time"],
  ];
  return (
    <div className="range-bar">
      <div className="range-presets">
        {presets.map(([key, label]) => (
          <button key={key} type="button" className={preset === key ? "chip active" : "chip"} onClick={() => onPreset(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="range-custom">
        <CalendarClock size={15} />
        <input type="date" value={range.start} max={range.end} onChange={(e) => onCustom({ ...range, start: e.target.value })} />
        <span className="range-arrow">→</span>
        <input type="date" value={range.end} min={range.start} onChange={(e) => onCustom({ ...range, end: e.target.value })} />
      </div>
    </div>
  );
}

function KpiTile({ label, value, sub }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  );
}

function BarList({ items, color = "#0f766e", total }) {
  const max = Math.max(...items.map((i) => i.n), 1);
  return (
    <div className="barlist">
      {items.map((it) => (
        <div className="bar-row" key={it.key}>
          <span className="bar-label" title={it.label}>{it.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max((it.n / max) * 100, it.n ? 2 : 0)}%`, background: it.color || color }} />
          </div>
          <span className="bar-val">
            {fmt(it.n)}
            {total ? <em>{Math.round((it.n / total) * 100)}%</em> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function Histogram({ buckets }) {
  const max = Math.max(...buckets.map((b) => b.n), 1);
  return (
    <div className="histogram">
      {buckets.map((b) => (
        <div className="hist-col" key={b.label}>
          <span className="hist-count">{b.n}</span>
          <div className="hist-track">
            <div
              className="hist-bar"
              style={{ height: `${Math.max((b.n / max) * 100, b.n ? 3 : 0)}%` }}
              title={`${b.n} students applied to ${b.label} ${b.label === "1" ? "opportunity" : "opportunities"}`}
            />
          </div>
          <span className="hist-x">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ points }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  if (!points.length) return <p className="chart-empty">No applications in this range.</p>;
  const W = 720, H = 220, padL = 34, padR = 12, padT = 14, padB = 26;
  const maxA = Math.max(...points.map((p) => p.apps), 1);
  const n = points.length;
  const innerW = W - padL - padR;
  const px = (i) => padL + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const py = (v) => padT + (1 - v / maxA) * (H - padT - padB);
  const linePath = points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(p.apps).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${px(n - 1).toFixed(1)},${(H - padB).toFixed(1)} L${px(0).toFixed(1)},${(H - padB).toFixed(1)} Z`;
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((mx - padL) / innerW) * (n - 1))));
    setHoverIdx(i);
  };
  const hp = hoverIdx != null ? points[hoverIdx] : null;
  return (
    <div className="trend-wrap">
      {hp ? (
        <div className="trend-tip">
          <strong>{shortDate(hp.date)}</strong> — {hp.apps} applications · {hp.students} students
        </div>
      ) : (
        <div className="trend-tip muted">Hover the line for daily detail</div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
        {[0, maxA].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={py(v)} y2={py(v)} className="grid-line" />
            <text x={padL - 6} y={py(v) + 3} className="axis-text" textAnchor="end">{v}</text>
          </g>
        ))}
        <path d={areaPath} className="trend-area" />
        <path d={linePath} className="trend-line" />
        {points.map((p, i) => (n > 45 ? null : <circle key={i} cx={px(i)} cy={py(p.apps)} r={2.4} className="trend-dot" />))}
        <text x={px(0)} y={H - 8} className="axis-text" textAnchor="start">{shortDate(points[0].date)}</text>
        {n > 1 ? <text x={px(n - 1)} y={H - 8} className="axis-text" textAnchor="end">{shortDate(points[n - 1].date)}</text> : null}
        {hp ? (
          <g>
            <line x1={px(hoverIdx)} x2={px(hoverIdx)} y1={padT} y2={H - padB} className="hover-line" />
            <circle cx={px(hoverIdx)} cy={py(hp.apps)} r={4} className="hover-dot" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

// Last resolved analytics view (range + data), kept across mounts so returning
// to Analytics (after opening a student) shows instantly instead of re-fetching.
let analyticsSnapshot = null;

function AdminAnalyticsView({ adminToken, navigate = () => {} }) {
  // Restored on re-mount (e.g. after opening a student and hitting Back) so the
  // page shows instantly instead of re-fetching with a loading flash.
  const snap = analyticsSnapshot;
  const [preset, setPreset] = useState(() => snap?.preset ?? "this_month");
  const [range, setRange] = useState(() => snap?.range ?? presetRange("this_month"));
  const [data, setData] = useState(() => snap?.data ?? null);
  const [loading, setLoading] = useState(() => !snap?.data);
  const [error, setError] = useState("");
  const [openStudent, setOpenStudent] = useState(null);
  const [openCategory, setOpenCategory] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSort, setStudentSort] = useState({ key: "apps", dir: "desc" });
  const [showExport, setShowExport] = useState(false); // column-picker popover
  const [exportFields, setExportFields] = useState(DEFAULT_EXPORT_FIELDS);
  // When "This month" has no data yet, we jump to the latest month that does.
  const [fallbackNote, setFallbackNote] = useState(() => snap?.fallbackNote ?? "");
  const didFallback = useRef(!!snap); // already resolved if restored from snapshot

  // Keep the module snapshot in sync so the next mount can restore it.
  useEffect(() => {
    if (data) analyticsSnapshot = { preset, range, data, fallbackNote };
  }, [preset, range, data, fallbackNote]);

  useEffect(() => {
    let live = true;
    // Only show the skeleton on a true cold load; a re-mount with cached data
    // refreshes silently in the background.
    setData((d) => { if (!d) setLoading(true); return d; });
    setError("");
    setOpenStudent(null);
    setOpenCategory(null);
    const q = new URLSearchParams();
    if (range.start) q.set("start", range.start);
    if (range.end) q.set("end", range.end);
    apiRequest(`/admin/analytics?${q.toString()}`, { adminToken })
      .then((d) => {
        if (!live) return;
        setData(d);
        // "This month" is empty at a month boundary — open on the newest month
        // that actually has data instead of a blank page.
        if (preset === "this_month" && !didFallback.current && (d.kpis?.applications ?? 0) === 0) {
          const months = (d.by_month || []).filter((m) => m.n > 0);
          if (months.length) {
            const latest = months[months.length - 1];
            didFallback.current = true;
            setFallbackNote(`This month has no applications yet — showing ${monthLabel(latest.month)}.`);
            setRange(monthRangeFromYM(latest.month));
          }
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [range.start, range.end, adminToken, preset]);

  // Active-students table: name search + sort by Applied / Shortlisted count.
  const activeStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const rows = (data?.top_students || []).filter((s) => !q || (s.name || "").toLowerCase().includes(q));
    const { key, dir } = studentSort;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (key === "name") return mul * (a.name || "").localeCompare(b.name || "");
      const av = key === "shortlisted" ? a.shortlisted ?? 0 : a.apps ?? 0;
      const bv = key === "shortlisted" ? b.shortlisted ?? 0 : b.apps ?? 0;
      return mul * (av - bv);
    });
  }, [data, studentSearch, studentSort]);

  function toggleStudentSort(key) {
    setOpenStudent(null);
    setStudentSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" }
    );
  }

  function toggleExportField(key) {
    setExportFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  // Export the active-students list (respects the current search + sort) to CSV,
  // which opens directly as a Google Sheet. One row per unique student, columns
  // are whatever the admin ticked.
  function exportActiveStudents() {
    const fields = ACTIVE_STUDENT_FIELDS.filter((f) => exportFields.includes(f.key));
    if (!fields.length || !activeStudents.length) return;
    const headers = fields.map((f) => f.label);
    const rows = activeStudents.map((s) => fields.map((f) => f.val(s)));
    const span = range?.start && range?.end ? `${range.start}_to_${range.end}` : "all";
    downloadCsv(`active-students_${span}.csv`, headers, rows);
    setShowExport(false);
  }

  const kpis = data?.kpis || {};
  const statusItems = (data?.status || []).map((s) => ({ key: s.key, label: statusMeta(s.key).label, color: statusMeta(s.key).color, n: s.n }));
  const funnelItems = (data?.funnel || []).map((f) => ({ key: f.key, label: f.key, n: f.n }));
  const companyItems = (data?.top_companies || []).map((c, i) => ({ key: `${c.name}-${i}`, label: c.name, n: c.n }));

  return (
    <div className="analytics-view">
      <DateRangeControl
        preset={preset}
        range={range}
        onPreset={(p) => {
          didFallback.current = false;
          setFallbackNote("");
          setPreset(p);
          setRange(presetRange(p));
        }}
        onCustom={(r) => {
          didFallback.current = false;
          setFallbackNote("");
          setPreset("custom");
          setRange(r);
        }}
      />

      {fallbackNote ? <p className="range-note">{fallbackNote}</p> : null}
      {error ? <StatusMessage error={error} /> : null}

      {loading || !data ? (
        <PanelLoader />
      ) : (
        <>
          <section className="kpi-grid">
            <KpiTile label="Applications" value={fmt(kpis.applications)} sub={`${data.daily.length} active day(s)`} />
            <KpiTile label="Students applied" value={fmt(kpis.students)} sub={`avg ${data.apps_per_student.avg} openings each`} />
            <KpiTile label="Companies" value={fmt(kpis.companies)} sub={`${fmt(kpis.opportunities)} openings`} />
            <KpiTile label="Interested" value={fmt(kpis.interested)} sub={`${kpis.interest_rate}% of applications`} />
            <KpiTile label="Shortlisted" value={fmt(kpis.shortlisted)} sub={`${kpis.shortlist_rate}% of interested`} />
            <KpiTile label="Selected" value={fmt(kpis.selected)} />
            <KpiTile label="New students" value={fmt(kpis.new_students)} sub="onboarded in range" />
            <KpiTile label="New openings" value={fmt(kpis.new_opportunities)} sub="received in range" />
          </section>

          {/* <section className="panel wide">
            <div className="panel-title">
              <TrendingUp size={18} />
              <h2>Applications over time</h2>
            </div>
            <TrendChart points={data.daily} />
          </section> */}

          <section className="analytics-2col">
            <div className="panel">
              <div className="panel-title">
                <BarChart3 size={18} />
                <h2>Pipeline funnel</h2>
              </div>
              <BarList items={funnelItems} total={kpis.applications} />
            </div>
            <div className="panel">
              <div className="panel-title">
                <FileText size={18} />
                <h2>Status breakdown</h2>
              </div>
              {statusItems.length ? <BarList items={statusItems} total={kpis.applications} /> : <p className="chart-empty">No data.</p>}
            </div>
          </section>

          <section className="analytics-2col">
            <div className="panel">
              <div className="panel-title">
                <UsersRound size={18} />
                <h2>Opportunities per student</h2>
              </div>
              <Histogram buckets={data.apps_per_student.buckets} />
              <p className="chart-note">
                Avg <strong>{data.apps_per_student.avg}</strong> openings per student · most active applied to <strong>{data.apps_per_student.max}</strong>
              </p>
            </div>
            <div className="panel">
              <div className="panel-title">
                <Building2 size={18} />
                <h2>Top companies by applications</h2>
              </div>
              {companyItems.length ? <BarList items={companyItems} /> : <p className="chart-empty">No data.</p>}
            </div>
          </section>

          <section className="panel wide">
            <div className="panel-title">
              <Sparkles size={18} />
              <h2>Opportunities by role</h2>
            </div>
            {data.role_categories?.length ? (
              <div className="role-cats">
                {data.role_categories.map((c) => (
                  <div className="role-cat" key={c.category}>
                    <button
                      type="button"
                      className={`role-cat-head ${openCategory === c.category ? "is-open" : ""}`}
                      onClick={() => setOpenCategory(openCategory === c.category ? null : c.category)}
                    >
                      <ChevronRight size={16} className="role-caret" />
                      <span className="role-cat-name">{c.category}</span>
                      <span className="role-cat-stats">
                        <b>{c.opportunities}</b> openings · <b>{c.applications}</b> apps · <b>{c.shortlisted}</b> shortlisted
                      </span>
                    </button>
                    {openCategory === c.category ? (
                      <div className="role-cat-body">
                        {c.companies.map((co, idx) => (
                          <div className="expand-row" key={idx}>
                            <div className="expand-company">
                              <strong>{co.company}</strong>
                              <span>{co.role}</span>
                            </div>
                            <div className="role-cat-counts">
                              <span className="mini-count">{co.apps} apps</span>
                              <span className="mini-count good">{co.shortlisted} shortlisted</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="chart-empty">No data.</p>
            )}
          </section>

          <section className="panel wide">
            <div className="panel-title">
              <Trophy size={18} />
              <h2>Active students</h2>
              {data.top_students.length ? <span className="title-count">{data.top_students.length}</span> : null}
              <span className="title-hint">applied to 2+ openings in range · click a row for their companies</span>
            </div>
            {data.top_students.length ? (
              <>
                <div className="student-filter">
                  <span className="sd-search">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    <input
                      placeholder="Search student name…"
                      value={studentSearch}
                      onChange={(e) => { setStudentSearch(e.target.value); setOpenStudent(null); }}
                    />
                  </span>
                  <span className="student-filter-count">{activeStudents.length} shown</span>
                  <div className="sd-export">
                    <button
                      type="button"
                      className="sd-download"
                      onClick={() => setShowExport((v) => !v)}
                      disabled={!activeStudents.length}
                      title="Download as CSV (opens in Google Sheets)"
                    >
                      <Download size={15} /> Download
                      <ChevronDown size={14} />
                    </button>
                    {showExport ? (
                      <div className="sd-export-menu">
                        <div className="sd-export-head">
                          <span>Columns to include</span>
                          <button type="button" className="link-button" onClick={() => setExportFields(ACTIVE_STUDENT_FIELDS.map((f) => f.key))}>
                            Select all
                          </button>
                        </div>
                        <div className="sd-export-fields">
                          {ACTIVE_STUDENT_FIELDS.map((f) => (
                            <label key={f.key} className="sd-export-field">
                              <input
                                type="checkbox"
                                checked={exportFields.includes(f.key)}
                                onChange={() => toggleExportField(f.key)}
                              />
                              {f.label}
                            </label>
                          ))}
                        </div>
                        <div className="sd-export-actions">
                          <button type="button" className="back-button" onClick={() => setShowExport(false)}>Cancel</button>
                          <button type="button" className="primary-button" onClick={exportActiveStudents} disabled={!exportFields.length}>
                            <Download size={14} /> Download CSV
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="admin-table analytics-table scrollable" data-scroll-key="active-students">
                  <div className="admin-head">
                    <span>Student</span>
                    <button
                      type="button"
                      className={`sort-th ${studentSort.key === "apps" ? "on" : ""}`}
                      onClick={() => toggleStudentSort("apps")}
                    >
                      Applied{studentSort.key === "apps" ? (studentSort.dir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                    <button
                      type="button"
                      className={`sort-th ${studentSort.key === "shortlisted" ? "on" : ""}`}
                      onClick={() => toggleStudentSort("shortlisted")}
                    >
                      Shortlisted{studentSort.key === "shortlisted" ? (studentSort.dir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  </div>
                  {activeStudents.length ? activeStudents.map((s, i) => {
                    const rowKey = s.id || s.name || i;
                    return (
                      <React.Fragment key={rowKey}>
                        <div
                          className={`admin-row analytics-student ${openStudent === rowKey ? "is-open" : ""}`}
                          onClick={() => setOpenStudent(openStudent === rowKey ? null : rowKey)}
                        >
                          <div className="student-name-cell">
                            <ChevronRight size={15} className="row-caret" />
                            {s.id ? (
                              <button
                                type="button"
                                className="link-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(["admin", "student", s.id]);
                                }}
                              >
                                {s.name}
                              </button>
                            ) : (
                              <strong>{s.name}</strong>
                            )}
                          </div>
                          <div><span className="mini-count">{s.apps}</span></div>
                          <div><span className="mini-count good">{s.shortlisted}</span></div>
                        </div>
                        {openStudent === rowKey ? (
                          <div className="student-expand">
                            <div className="student-expand-head">
                              <span>Companies applied in this range</span>
                            </div>
                            {s.applications?.length ? (
                              <div className="expand-list">
                                {s.applications.map((a, j) => (
                                  <div className="expand-row" key={j}>
                                    <div className="expand-company">
                                      <strong>{a.company}</strong>
                                      <span>{a.role}</span>
                                      {a.remark ? <span className="expand-remark">“{a.remark}”</span> : null}
                                    </div>
                                    <div className="expand-status">
                                      <StatusChip status={a.status} />
                                      <span className="date-line"><CalendarClock size={13} />{formatDate(a.applied_at)}</span>
                                    </div>
                                    <span className="cat-tag">{a.category}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="expand-empty">No applications in this range.</p>
                            )}
                          </div>
                        ) : null}
                      </React.Fragment>
                    );
                  }) : (
                    <p className="chart-empty">No students match “{studentSearch}”.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="chart-empty">No data.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* --------------------------- Student profile --------------------------- */

function ProfileField({ label, value }) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function AdminInterviewReportCard({ report }) {
  const overall = report.overall || {};
  const comm = report.communication || {};
  const expectations = report.company_expectations || {};
  const answers = Array.isArray(report.answers) ? report.answers : [];
  const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  // Improvements arrive as { area, detail, priority }; strengths as plain
  // strings. Render both readably instead of dumping raw JSON.
  const text = (x) => {
    if (typeof x === "string") return x;
    if (!x || typeof x !== "object") return String(x ?? "");
    if (x.area || x.detail) return [x.area, x.detail].filter(Boolean).join(" — ");
    return x.point || x.note || x.text || "";
  };
  // answers[].accuracy is 0-100; the RSA shows a rating out of 5.
  const rating5 = (accuracy) => (accuracy == null ? null : Math.round((accuracy / 20) * 10) / 10);

  return (
    <div className="report-card">
      {overall.summary ? <p className="report-summary">{overall.summary}</p> : null}

      {report.interviewer_satisfaction ? (
        <div className="report-sec">
          <strong>How they met the bar</strong>
          <p>{report.interviewer_satisfaction}</p>
        </div>
      ) : null}

      {answers.length ? (
        <div className="report-sec">
          <strong>Questions &amp; answers</strong>
          <div className="rsa-qa">
            {answers.map((a, i) => {
              const r = rating5(a.accuracy);
              return (
                <div className="rsa-q" key={i}>
                  <div className="rsa-q-head">
                    <span className="rsa-q-text">Q{i + 1}. {a.question_text}</span>
                    {r != null ? <span className="rsa-rating">{r}/5</span> : null}
                  </div>
                  {a.student_answer ? <p className="rsa-line"><span>Candidate</span>{a.student_answer}</p> : null}
                  {a.ideal_answer ? <p className="rsa-line rsa-ideal"><span>Expected</span>{a.ideal_answer}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {asList(report.strengths).length ? (
        <div className="report-sec">
          <strong>Strengths</strong>
          <ul>{asList(report.strengths).map((x, i) => <li key={i}>{text(x)}</li>)}</ul>
        </div>
      ) : null}
      {asList(report.improvements).length ? (
        <div className="report-sec">
          <strong>Areas to improve</strong>
          <ul>{asList(report.improvements).map((x, i) => <li key={i}>{text(x)}</li>)}</ul>
        </div>
      ) : null}

      {report.coaching_note ? (
        <div className="report-sec report-coaching">
          <strong>Coaching for next time</strong>
          <p>{report.coaching_note}</p>
        </div>
      ) : null}

      {comm.notes ? (
        <div className="report-sec">
          <strong>Communication</strong>
          <p>{comm.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

function StudentProfileView({ adminToken, studentId, navigate, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setFilter("all");
    apiRequest(`/admin/students/${studentId}`, { adminToken })
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [studentId, adminToken]);

  const s = data?.student;
  const stats = data?.stats || {};
  const apps = data?.applications || [];
  const filtered = apps.filter((a) =>
    filter === "shortlisted"
      ? a.status === "SHORTLISTED"
      : filter === "declined"
        ? !a.interested
        : filter === "interested"
          ? a.interested
          : true,
  );

  return (
    <>
      <header className="topbar">
        <div className="topbar-lead">
          <button type="button" className="back-button" onClick={onBack}>
            <ArrowLeft size={17} /> Back
          </button>
          <div>
            <p className="eyebrow">Student</p>
            <h1>{s?.name || "Student"}</h1>
          </div>
        </div>
      </header>

      {error ? <StatusMessage error={error} /> : null}

      {loading || !data ? (
        <PanelLoader />
      ) : (
        <>
          <section className="panel wide profile-card">
            <div className="profile-fields">
              <ProfileField label="Email" value={s.email} />
              <ProfileField label="Phone" value={s.phone} />
              <ProfileField label="College" value={s.college_name} />
              <ProfileField label="Degree" value={[s.degree, s.department].filter(Boolean).join(" · ")} />
              <ProfileField label="Year of passing" value={s.year_of_passing} />
              <ProfileField label="City" value={s.current_city} />
              <ProfileField label="Mentor" value={s.technical_developer_name} />
            </div>
            <div className="profile-actions">
              {s.resume_link ? (
                <a className="back-button" href={s.resume_link} target="_blank" rel="noreferrer">
                  <FileText size={15} /> Resume
                </a>
              ) : null}
              {s.placed_status ? (
                <span className="status-chip" style={{ color: "#15803d", borderColor: "#15803d" }}>Placed</span>
              ) : null}
            </div>
          </section>

          <section className="kpi-grid">
            <KpiTile label="Applied" value={fmt(stats.interested)} sub={`${fmt(stats.responses)} responses`} />
            <KpiTile label="Shortlisted" value={fmt(stats.shortlisted)} />
            <KpiTile label="Selected" value={fmt(stats.selected)} />
            <KpiTile label="Declined" value={fmt(stats.declined)} sub="not interested" />
          </section>

          {data.role_breakdown?.length ? (
            <section className="panel wide">
              <div className="panel-title">
                <Sparkles size={18} />
                <h2>Role interest mix</h2>
              </div>
              <BarList items={data.role_breakdown.map((r) => ({ key: r.category, label: r.category, n: r.n }))} />
            </section>
          ) : null}

          <section className="panel wide">
            <div className="panel-title">
              <BriefcaseBusiness size={18} />
              <h2>Applications</h2>
              <div className="filter-chips">
                {[["all", "All"], ["interested", "Applied"], ["shortlisted", "Shortlisted"], ["declined", "Declined"]].map(([k, l]) => (
                  <button key={k} type="button" className={filter === k ? "chip active" : "chip"} onClick={() => setFilter(k)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {filtered.length ? (
              <div className="admin-table applicants-table scrollable" data-scroll-key="applicants">
                <div className="admin-head">
                  <span>Company</span>
                  <span>Status</span>
                  <span>Applied</span>
                  <span>Links</span>
                </div>
                {filtered.map((a, i) => {
                  const links = [["Resume", a.resume_link], ["GitHub", a.github_link], ["Project", a.project_link]].filter(([, h]) => Boolean(h));
                  return (
                    <div className="admin-row" key={i}>
                      <div>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => a.company_id && navigate(["admin", "company", a.company_id])}
                        >
                          {a.company}
                        </button>
                        <span>{a.role} · {a.category}</span>
                      </div>
                      <div><StatusChip status={a.status} /></div>
                      <div><span>{formatDate(a.applied_at)}</span></div>
                      <div className="link-group">
                        {links.length ? (
                          links.map(([l, h]) => (
                            <a key={l} href={h} target="_blank" rel="noreferrer" title={l}>
                              <ExternalLink size={14} />
                              {l}
                            </a>
                          ))
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="chart-empty">No applications in this filter.</p>
            )}
          </section>

          <section className="panel wide">
            <div className="panel-title">
              <MessageSquareQuote size={18} />
              <h2>Interview feedback</h2>
              {data.reports.length ? <span className="title-count">{data.reports.length}</span> : null}
            </div>
            {data.reports.length ? (
              <div className="report-cards">
                {data.reports.map((r, i) => <AdminInterviewReportCard key={i} report={r} />)}
              </div>
            ) : (
              <p className="chart-empty">No interview reports yet.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}

function CompanyDetailView({ adminToken, companyId, onBack, selectedOppId, onSelectOpp, onDataChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [oppData, setOppData] = useState(null);
  const [loadingOpp, setLoadingOpp] = useState(false);
  // Bumped after an import so BOTH the company stat tiles and the opportunity
  // detail refetch. Previously only the opportunity reloaded, which is why the
  // numbers at the top only changed after a manual page refresh.
  const [reloadKey, setReloadKey] = useState(0);
  const autoSelected = useRef(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    apiRequest(`/admin/companies/${companyId}`, { adminToken })
      .then((detail) => {
        if (!live) return;
        setData(detail);
        // With a single opening there is nothing to choose, so open it - but
        // only once per company, or it would fight a manual "back to list".
        if (
          detail.opportunity_count === 1
          && detail.opportunities?.[0]
          && !selectedOppId
          && autoSelected.current !== companyId
        ) {
          autoSelected.current = companyId;
          onSelectOpp(detail.opportunities[0].id);
        }
      })
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [companyId, adminToken, reloadKey]);

  useEffect(() => {
    if (!selectedOppId) {
      setOppData(null);
      return;
    }
    let live = true;
    setLoadingOpp(true);
    apiRequest(`/admin/opportunities/${selectedOppId}`, { adminToken })
      .then((detail) => live && setOppData(detail))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoadingOpp(false));
    return () => {
      live = false;
    };
  }, [selectedOppId, adminToken, reloadKey]);

  function refreshAll() {
    setReloadKey((value) => value + 1);
    onDataChanged?.();
  }

  const company = data?.company;
  const opportunities = data?.opportunities || [];
  const stats = data?.stats || {};
  const multi = (data?.opportunity_count || 0) > 1;

  return (
    <>
      <header className="topbar">
        <div className="topbar-lead">
          <button type="button" className="back-button" onClick={onBack}>
            <ArrowLeft size={17} /> Back
          </button>
          <div>
            <p className="eyebrow">Company</p>
            <h1>{company?.name || "Company"}</h1>
          </div>
        </div>
      </header>

      {error ? <StatusMessage error={error} /> : null}

      {loading ? (
        <PanelLoader />
      ) : !data ? (
        <div className="empty-state compact"><p>Company not found.</p></div>
      ) : (
        <>
          <section className="stats-grid admin-stats">
            <Metric icon={<BriefcaseBusiness size={20} />} label="Opportunities" value={data.opportunity_count ?? 0} />
            <Metric icon={<UsersRound size={20} />} label="Applied" value={stats.applied_count ?? 0} />
            <Metric icon={<BadgeCheck size={20} />} label="Shortlisted" value={stats.shortlisted_count ?? 0} />
            <Metric icon={<BarChart3 size={20} />} label="Responses" value={stats.response_count ?? 0} />
          </section>

          {multi && !selectedOppId ? (
            <OpportunityChooser opportunities={opportunities} onSelect={onSelectOpp} />
          ) : null}

          {selectedOppId ? (
            <>
              {multi ? (
                <button type="button" className="back-button subtle" onClick={() => onSelectOpp(null)}>
                  <ArrowLeft size={16} /> Other opportunities ({data.opportunity_count})
                </button>
              ) : null}
              {loadingOpp || !oppData ? (
                <PanelLoader />
              ) : (
                <OpportunityDetail
                  detail={oppData}
                  adminToken={adminToken}
                  opportunityId={selectedOppId}
                  onRefresh={refreshAll}
                />
              )}
            </>
          ) : null}
        </>
      )}
    </>
  );
}

function OpportunityChooser({ opportunities, onSelect }) {
  return (
    <section className="panel wide">
      <div className="panel-title">
        <BriefcaseBusiness size={20} />
        <h2>Choose an opportunity</h2>
        <span className="title-count">{opportunities.length}</span>
      </div>
      <p className="chooser-hint">This company has multiple opportunities. Pick one to see its detail.</p>
      <div className="chooser-list">
        {opportunities.map((opportunity) => (
          <button key={opportunity.id} type="button" className="chooser-card" onClick={() => onSelect(opportunity.id)}>
            <div className="chooser-role">
              <strong>{opportunity.role || "Role not mapped"}</strong>
              <span>{opportunity.tech_stack || opportunity.must_have_skills || "Skills not mapped"}</span>
            </div>
            <div className="chooser-meta">
              <span>{opportunity.location || "Location N/A"}</span>
              <span>{formatDate(opportunity.opportunity_received_at)}</span>
            </div>
            <div className="chooser-counts">
              <span className="mini-count">{opportunity.applied_count ?? 0} applied</span>
              <span className="mini-count good">{opportunity.shortlisted_count ?? 0} shortlisted</span>
              {opportunity.company_status ? (
                <span className={`status-pill ${companyStatusClass(opportunity.company_status)}`}>{opportunity.company_status}</span>
              ) : null}
            </div>
            <ArrowRight size={18} className="chooser-arrow" />
          </button>
        ))}
      </div>
    </section>
  );
}

function DetailGroup({ title, fields }) {
  const rows = fields.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!rows.length) return null;
  return (
    <>
      <h3 className="detail-subhead">{title}</h3>
      <div className="profile-list detail-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 *  RSA interview reports: transcript -> proposal -> analysis -> publish
 * ------------------------------------------------------------------ */

const rsaApi = {
  propose: (adminToken, rawText, opportunityId) =>
    apiRequest("/interview-sessions/transcript/propose", {
      method: "POST",
      adminToken,
      body: { raw_text: rawText, opportunity_id: opportunityId },
    }),
  confirm: (adminToken, body) =>
    apiRequest("/interview-sessions/transcript/confirm", { method: "POST", adminToken, body }),
  analyze: (adminToken, sessionId) =>
    apiRequest(`/interview-sessions/${sessionId}/analyze`, { method: "POST", adminToken }),
  reports: (adminToken, sessionId) =>
    apiRequest(`/interview-sessions/${sessionId}/reports`, { adminToken }),
  setVisibility: (adminToken, reportId, visible) =>
    apiRequest(`/admin/reports/${reportId}/visibility`, {
      method: "PATCH",
      adminToken,
      body: { visible_to_student: visible },
    }),
  questions: (adminToken, opportunityId) =>
    apiRequest(`/admin/questions?opportunity_id=${opportunityId}&technical_only=false`, { adminToken }),
  sessions: (adminToken, opportunityId) =>
    apiRequest(`/interview-sessions/?opportunity_id=${opportunityId}`, { adminToken }),
  deleteSession: (adminToken, sessionId) =>
    apiRequest(`/interview-sessions/${sessionId}`, { method: "DELETE", adminToken }),
};

const sheetApi = {
  preview: (adminToken, opportunityId, kind, rawText) =>
    apiRequest(`/admin/opportunities/${opportunityId}/import/${kind}`, {
      method: "POST",
      adminToken,
      body: { raw_text: rawText, confirm: false },
    }),
  confirm: (adminToken, opportunityId, kind, rawText) =>
    apiRequest(`/admin/opportunities/${opportunityId}/import/${kind}`, {
      method: "POST",
      adminToken,
      body: { raw_text: rawText, confirm: true },
    }),
  sync: (adminToken, opportunityId, kind, confirm, force = false, replace = false) =>
    apiRequest(`/admin/opportunities/${opportunityId}/sync/${kind}`, {
      method: "POST",
      adminToken,
      body: { confirm, force, replace },
    }),
  masterFetch: (adminToken, url, confirm) =>
    apiRequest("/admin/companies/import/fetch", {
      method: "POST",
      adminToken,
      body: { url, confirm },
    }),
  updateLinks: (adminToken, opportunityId, links) =>
    apiRequest(`/admin/opportunities/${opportunityId}/sheet-links`, {
      method: "PATCH",
      adminToken,
      body: links,
    }),
};

const IGNORE = "__ignore__";
const INTERVIEWER = "__interviewer__";

function verdictClass(verdict) {
  if (verdict === "strong") return "good";
  if (verdict === "weak") return "bad";
  return "warn";
}

function correctnessClass(value) {
  if (value === "correct") return "good";
  if (value === "incorrect" || value === "not_answered") return "bad";
  return "warn";
}

/* --- Step 1: paste the transcript --------------------------------- */
function TranscriptUpload({ onPropose, busy }) {
  const [text, setText] = useState("");
  return (
    <div className="rsa-upload">
      <p className="rsa-hint">
        Paste the full Google Meet transcript, including the date and title lines at the top.
        Nothing is saved until you review and confirm the next screen.
      </p>
      <textarea
        className="rsa-textarea"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"Jun 26, 2026\nInterviews | Nxtwave X WeSee  - Transcript\n00:00:00\n\nInterviewer: ...\nStudent: ..."}
        spellCheck={false}
      />
      <div className="rsa-actions">
        <span className="muted">{text.trim() ? `${text.trim().split(/\s+/).length} words` : "Empty"}</span>
        <button className="primary-button" type="button" disabled={!text.trim() || busy} onClick={() => onPropose(text)}>
          {busy ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
          Read transcript
        </button>
      </div>
    </div>
  );
}

/* --- Step 2: review what we detected ------------------------------ */
function ProposalReview({ proposal, shortlist, onBack, onConfirm, busy }) {
  const [choices, setChoices] = useState(() => {
    const initial = {};
    (proposal.speaker_map || []).forEach((entry) => {
      if (entry.role === "student" && entry.student_id) initial[entry.speaker_label] = entry.student_id;
      else if (entry.role === "interviewer") initial[entry.speaker_label] = INTERVIEWER;
      else initial[entry.speaker_label] = IGNORE;
    });
    return initial;
  });

  const confidenceBy = useMemo(() => {
    const map = {};
    (proposal.speaker_map || []).forEach((entry) => {
      map[entry.speaker_label] = entry.confidence;
    });
    return map;
  }, [proposal]);

  const blockBy = useMemo(() => {
    const map = {};
    (proposal.blocks || []).forEach((block) => {
      map[block.speaker_label] = block;
    });
    return map;
  }, [proposal]);

  const studentCount = Object.values(choices).filter((v) => v !== IGNORE && v !== INTERVIEWER).length;

  function buildSpeakerMap() {
    return Object.entries(choices).map(([speaker_label, value]) => {
      if (value === INTERVIEWER) return { speaker_label, student_id: null, role: "interviewer" };
      if (value === IGNORE) return { speaker_label, student_id: null, role: "unknown" };
      return { speaker_label, student_id: value, role: "student" };
    });
  }

  return (
    <div className="rsa-review">
      <div className="rsa-detected">
        <div>
          <span>Meeting date</span>
          <strong>{proposal.header?.meeting_date ? formatDate(proposal.header.meeting_date) : "Not detected"}</strong>
        </div>
        <div>
          <span>Interviewer</span>
          <strong>{proposal.interviewer || "Not detected"}</strong>
        </div>
        <div>
          <span>Candidates found</span>
          <strong>{(proposal.blocks || []).length}</strong>
        </div>
        <div>
          <span>Transcript lines</span>
          <strong>{proposal.segment_count}</strong>
        </div>
      </div>

      {(proposal.warnings || []).length ? (
        <div className="rsa-warnings">
          {proposal.warnings.map((warning) => (
            <div key={warning} className="rsa-warning">
              <TriangleAlert size={16} />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      ) : null}

      <h3 className="detail-subhead">Who is who</h3>
      <p className="rsa-hint">
        We matched each speaker to a shortlisted student. Check the low-confidence ones before continuing.
      </p>
      <div className="rsa-map">
        {Object.keys(choices).map((speaker) => {
          const confidence = confidenceBy[speaker];
          const block = blockBy[speaker];
          const isStudent = choices[speaker] !== IGNORE && choices[speaker] !== INTERVIEWER;
          return (
            <div className="rsa-map-row" key={speaker}>
              <div className="rsa-speaker">
                <strong>{speaker}</strong>
                <span>
                  {block ? `${block.segment_count} turns` : "no block"}
                  {isStudent && confidence ? ` · match ${Math.round(confidence * 100)}%` : ""}
                </span>
              </div>
              <select
                className="sort-select"
                value={choices[speaker]}
                onChange={(event) => setChoices((prev) => ({ ...prev, [speaker]: event.target.value }))}
              >
                <option value={IGNORE}>Ignore this speaker</option>
                <option value={INTERVIEWER}>Interviewer</option>
                {shortlist.map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.name}
                  </option>
                ))}
              </select>
              {isStudent && confidence !== undefined && confidence < 0.8 ? (
                <span className="status-pill warn">verify</span>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>

      {(proposal.missing_students || []).length ? (
        <div className="rsa-noshow">
          <strong>Shortlisted but never spoke:</strong>{" "}
          {proposal.missing_students.map((student) => student.name).join(", ")}
        </div>
      ) : null}

      <div className="rsa-actions">
        <button className="back-button" type="button" onClick={onBack} disabled={busy}>
          <ArrowLeft size={16} /> Back
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!studentCount || busy}
          onClick={() => onConfirm(buildSpeakerMap())}
        >
          {busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
          {busy ? "Analysing…" : `Confirm & analyse ${studentCount} candidate${studentCount === 1 ? "" : "s"}`}
        </button>
      </div>
      {busy ? <p className="rsa-hint">This runs one AI pass per candidate and can take up to a minute.</p> : null}
    </div>
  );
}

/* --- Step 3: the generated reports -------------------------------- */
function ReportCard({ report, adminToken, onChanged }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const overall = report.overall || {};
  const student = report.student || {};

  async function togglePublish() {
    setSaving(true);
    try {
      await rsaApi.setVisibility(adminToken, report.id, !report.visible_to_student);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  const skills = Object.entries(report.skill_ratings || {});

  return (
    <div className="rsa-report">
      <div className="rsa-report-head">
        <button type="button" className="rsa-expand" onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <div>
            <strong>{student.name || "Student"}</strong>
            <span>{report.answers?.length || 0} questions answered</span>
          </div>
        </button>
        <span className="rsa-score">{overall.score ?? "–"}<small>/10</small></span>
        <span className={`status-pill ${verdictClass(overall.verdict)}`}>{overall.verdict || "n/a"}</span>
        <button
          type="button"
          className={report.visible_to_student ? "rsa-pub on" : "rsa-pub"}
          onClick={togglePublish}
          disabled={saving}
        >
          {saving ? <Loader2 className="spin" size={15} /> : report.visible_to_student ? <Eye size={15} /> : <EyeOff size={15} />}
          {report.visible_to_student ? "Visible to student" : "Publish to student"}
        </button>
      </div>

      {open ? (
        <div className="rsa-report-body">
          {overall.summary ? <p className="rsa-summary">{overall.summary}</p> : null}

          {report.interviewer_feedback ? (
            <div className="rsa-quote">
              <MessageSquareQuote size={16} />
              <div>
                <strong>Interviewer said</strong>
                <p>{report.interviewer_feedback}</p>
              </div>
            </div>
          ) : null}

          <div className="rsa-cols">
            <div>
              <h4><CheckCircle2 size={15} /> Strengths</h4>
              {report.strengths?.length ? (
                <ul>{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              ) : (
                <p className="muted">None recorded.</p>
              )}
            </div>
            <div>
              <h4><Lightbulb size={15} /> Needs improvement</h4>
              {report.improvements?.length ? (
                <ul>
                  {report.improvements.map((imp, index) => (
                    <li key={index}>
                      <span className={`rsa-prio ${imp.priority}`}>{imp.priority}</span>
                      <strong>{imp.area}</strong> — {imp.detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">None recorded.</p>
              )}
            </div>
          </div>

          {skills.length ? (
            <>
              <h4><BarChart3 size={15} /> Skills shown</h4>
              <div className="rsa-skills">
                {skills.map(([skill, rating]) => (
                  <div className="rsa-skill" key={skill}>
                    <span>{skill}</span>
                    <div className="rsa-bar"><i style={{ width: `${((rating || 0) / 5) * 100}%` }} /></div>
                    <b>{rating ?? "–"}/5</b>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <h4><CircleHelp size={15} /> Question by question</h4>
          <div className="rsa-answers">
            {(report.answers || []).map((answer, index) => (
              <div className="rsa-answer" key={index}>
                <div className="rsa-answer-head">
                  <strong>{answer.question_text}</strong>
                  <span className={`status-pill ${correctnessClass(answer.correctness)}`}>
                    {(answer.correctness || "").replaceAll("_", " ")}
                  </span>
                  <span className="rsa-acc">{answer.accuracy ?? 0}%</span>
                </div>
                {answer.student_answer ? <p><em>Said:</em> {answer.student_answer}</p> : null}
                {answer.feedback ? <p><em>Feedback:</em> {answer.feedback}</p> : null}
                {answer.ideal_answer ? <p className="rsa-ideal"><em>Better answer:</em> {answer.ideal_answer}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --- Questions extracted for this opportunity --------------------- */
function QuestionsPanel({ questions }) {
  const [category, setCategory] = useState("all");
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(questions.map((q) => q.category).filter(Boolean))).sort()],
    [questions],
  );
  const visible = questions.filter((q) => category === "all" || q.category === category);

  if (!questions.length) {
    return <div className="empty-state compact"><p>No questions extracted yet. Analyse a transcript first.</p></div>;
  }

  return (
    <>
      <div className="controls-row" style={{ marginBottom: 12 }}>
        <div className="filter-controls">
          <label>Topic:</label>
          <select className="sort-select" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>{item === "all" ? `All (${questions.length})` : item}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="rsa-questions scrollable" data-scroll-key="opp-questions">
        {visible.map((question) => (
          <div className="rsa-question" key={question.id}>
            <span className={`rsa-cat ${question.is_technical ? "tech" : ""}`}>{question.category}</span>
            <div>
              <strong>{question.question_text}</strong>
              {question.asked_to ? <span>asked to {question.asked_to}</span> : null}
            </div>
            {question.difficulty ? <span className="mini-count">{question.difficulty}</span> : null}
          </div>
        ))}
      </div>
    </>
  );
}

/* --- Add companies: paste rows from the master tracker ------------- */
const MASTER_URL_KEY = "rsa_master_sheet_url";

function AddCompaniesPanel({ adminToken, onImported }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [url, setUrl] = useState(() => localStorage.getItem(MASTER_URL_KEY) || "");
  const [fromUrl, setFromUrl] = useState(false); // whether the current preview came from a URL fetch
  const [preview, setPreview] = useState(null);
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setPreview(null);
    setApplied(null);
    setError("");
  }

  // Import from pasted text.
  async function run(confirm) {
    setBusy(true);
    setError("");
    setFromUrl(false);
    try {
      const result = await apiRequest("/admin/companies/import", {
        method: "POST",
        adminToken,
        body: { raw_text: text, confirm },
      });
      if (confirm) {
        setApplied(result);
        setPreview(null);
        setText("");
        onImported?.();
      } else {
        setPreview(result);
        setApplied(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Import by fetching the master sheet URL.
  async function runUrl(confirm) {
    setBusy(true);
    setError("");
    setFromUrl(true);
    try {
      const result = await sheetApi.masterFetch(adminToken, url.trim(), confirm);
      localStorage.setItem(MASTER_URL_KEY, url.trim());
      if (confirm) {
        setApplied(result);
        setPreview(null);
        onImported?.();
      } else {
        setPreview(result);
        setApplied(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const counts = preview?.counts || {};

  return (
    <div className="panel wide">
      <button
        type="button"
        className="panel-title collapsible"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Building2 size={20} />
        <h2>Add companies</h2>
        <span className="panel-toggle">{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
      </button>

      {open ? (
        <>
          <p className="rsa-hint">
            Pull the company master tracker from its Google Sheets link, or paste rows below. Each
            row creates a company and its opening, or updates them if they already exist.
          </p>

          {!preview && !applied ? (
            <div className="rsa-master-url">
              <input
                className="search-input"
                placeholder="Master sheet link (https://docs.google.com/spreadsheets/...)"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <button
                className="primary-button"
                type="button"
                disabled={!url.trim() || busy}
                onClick={() => runUrl(false)}
              >
                {busy && fromUrl ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                Pull from sheet
              </button>
            </div>
          ) : null}

          {error ? <StatusMessage error={error} /> : null}

          {applied ? (
            <div className="status success" style={{ marginBottom: 12 }}>
              <BadgeCheck size={18} />
              <span>
                Done — {applied.counts.companies_new} new compan
                {applied.counts.companies_new === 1 ? "y" : "ies"},{" "}
                {applied.counts.opportunities_to_create} opening(s) created,{" "}
                {applied.counts.opportunities_to_update} updated.
              </span>
            </div>
          ) : null}

          {!preview ? (
            <>
              <textarea
                className="rsa-textarea"
                value={text}
                onChange={(event) => setText(event.target.value)}
                spellCheck={false}
                placeholder={"Opportunity Received On\tReceived Time\tCompany Name\t…\tRole\t…\n3-Mar-2026\t11:21\tAcme AI\t…\tFrontend Intern\t…"}
              />
              <div className="rsa-actions">
                <span className="muted">{text.trim() ? `${text.trim().split("\n").length} line(s)` : "Empty"}</span>
                <button className="primary-button" type="button" disabled={!text.trim() || busy} onClick={() => run(false)}>
                  {busy ? <Loader2 className="spin" size={18} /> : <Eye size={18} />}
                  Preview
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rsa-detected">
                <div><span>Rows</span><strong>{counts.rows ?? 0}</strong></div>
                <div><span>New companies</span><strong>{counts.companies_new ?? 0}</strong></div>
                <div><span>Openings to create</span><strong>{counts.opportunities_to_create ?? 0}</strong></div>
                <div><span>Openings to update</span><strong>{counts.opportunities_to_update ?? 0}</strong></div>
                {counts.skipped ? <div><span>Skipped</span><strong>{counts.skipped}</strong></div> : null}
              </div>

              {(() => {
                const changed = (preview.rows || []).filter(
                  (r) => r.response_links_changed || r.company_links_changed,
                );
                return changed.length ? (
                  <div className="rsa-warning rsa-changed" style={{ marginBottom: 12 }}>
                    <RefreshCw size={16} />
                    <div>
                      <strong>Sheet links changed — after confirming, open these and Sync from sheets:</strong>
                      <ul>
                        {changed.map((r) => (
                          <li key={r.row}>
                            {r.company} · {r.role}
                            {r.received_on ? ` · ${r.received_on}` : ""}
                            {" — "}
                            {[r.response_links_changed ? "response" : null, r.company_links_changed ? "shortlist" : null]
                              .filter(Boolean)
                              .join(" & ")}{" "}
                            link
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null;
              })()}

              {(() => {
                const skips = (preview.rows || []).filter((r) => r.action === "skip");
                return skips.length ? (
                  <div className="rsa-warning" style={{ marginBottom: 12 }}>
                    <TriangleAlert size={16} />
                    <span>
                      {skips.length} row(s) will be skipped as malformed (e.g. row {skips[0].row}:
                      &quot;{skips[0].company}&quot;). These look like shifted rows in the sheet — fix
                      them there if they should import.
                    </span>
                  </div>
                ) : null;
              })()}

              <div className="rsa-preview-table">
                {(preview.rows || []).map((row) => (
                  <div className="rsa-preview-row" key={row.row}>
                    <span className="muted">{row.row}</span>
                    <div>
                      <strong>{row.company || "(no company)"}</strong>
                      <span>{row.role}{row.received_on ? ` · ${row.received_on}` : ""}</span>
                    </div>
                    <span className={`status-pill ${row.action === "skip" ? "bad" : row.action.includes("create") ? "neutral" : "good"}`}>
                      {row.action.replaceAll("_", " ").replace("opportunity", "opening")}
                    </span>
                    <span className="muted">{row.company_new ? "new company" : row.reason || ""}</span>
                  </div>
                ))}
              </div>

              <div className="rsa-actions">
                <button className="back-button" type="button" onClick={reset} disabled={busy}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => (fromUrl ? runUrl(true) : run(true))}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="spin" size={18} /> : <BadgeCheck size={18} />}
                  Confirm
                </button>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

/* Shows which sheet column mapped to each field, so a format change is
   visible instead of silently importing nothing. */
function ColumnMapping({ mapping }) {
  const FIELDS = [
    ["name", "Name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["uid", "Student ID"],
    ["resume", "Resume"],
    ["interested", "Interested"],
  ];
  return (
    <div className="rsa-mapping">
      <strong>Detected columns</strong>
      <div className="rsa-mapping-grid">
        {FIELDS.map(([key, label]) => (
          <div className="rsa-mapping-row" key={key}>
            <span className="rsa-mapping-field">{label}</span>
            <span className="rsa-mapping-arrow">←</span>
            {mapping[key] ? (
              <span className="rsa-mapping-col">{mapping[key]}</span>
            ) : (
              <span className="rsa-mapping-none">not found</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// A response/shortlist sheet link that changed after its last import points at
// a corrected sheet the admin should pull.
function changedSinceImport(changedAt, importedAt) {
  if (!changedAt) return false;
  if (!importedAt) return true;
  return new Date(changedAt).getTime() > new Date(importedAt).getTime();
}

/* --- Paste a response / shortlist sheet for this opening ----------- */
function SheetImportPanel({ adminToken, opportunityId, opportunity, onImported }) {
  const [kind, setKind] = useState("responses");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The guided fetch-from-sheet flow: responses first, then shortlist, so the
  // shortlist can match against the students the responses just created.
  const [syncStep, setSyncStep] = useState(null); // null | "responses" | "shortlist"
  const [skipped, setSkipped] = useState(null); // {kind, already_imported_at} when already extracted
  // Replace mode (responses only): drop candidates left over from a wrong sheet.
  const [replace, setReplace] = useState(false);
  // Inline sheet-link editor: fix a missing / wrong URL without re-importing the
  // whole master sheet, then Sync pulls the corrected data.
  const [showLinks, setShowLinks] = useState(false);
  const [respUrl, setRespUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");

  function toggleLinks() {
    if (!showLinks) {
      setRespUrl(opportunity?.student_response_sheet || "");
      setShortUrl(opportunity?.company_sheet || "");
      setLinkMsg("");
    }
    setShowLinks((open) => !open);
  }

  async function saveLinks() {
    const body = {};
    if (respUrl.trim() !== (opportunity?.student_response_sheet || "")) body.student_response_sheet = respUrl.trim();
    if (shortUrl.trim() !== (opportunity?.company_sheet || "")) body.company_sheet = shortUrl.trim();
    if (!Object.keys(body).length) {
      setLinkMsg("Nothing changed — edit a link first.");
      return;
    }
    setLinkBusy(true);
    setLinkMsg("");
    try {
      await sheetApi.updateLinks(adminToken, opportunityId, body);
      setLinkMsg("Saved. Now use “Sync from sheets” to pull the updated data.");
      onImported?.();
    } catch (e) {
      setLinkMsg(e.message || "Could not save the links.");
    } finally {
      setLinkBusy(false);
    }
  }

  function reset() {
    setPreview(null);
    setApplied(null);
    setSkipped(null);
    setError("");
  }

  function switchKind(next) {
    setKind(next);
    setText("");
    setSyncStep(null);
    setReplace(false);
    reset();
  }

  // A sync preview returns mode:"skipped" when the opening was already
  // extracted; show the Force option instead of a preview.
  async function syncPreview(step, force = false, replaceArg = replace) {
    setBusy(true);
    setError("");
    setPreview(null);
    setSkipped(null);
    try {
      // Replace only makes sense for the responses step.
      const useReplace = step === "responses" ? replaceArg : false;
      const result = await sheetApi.sync(adminToken, opportunityId, step, false, force, useReplace);
      if (result.mode === "skipped") setSkipped(result);
      else setPreview(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    setBusy(true);
    reset();
    try {
      setPreview(await sheetApi.preview(adminToken, opportunityId, kind, text));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError("");
    try {
      const result = await sheetApi.confirm(adminToken, opportunityId, kind, text);
      setApplied(result);
      setPreview(null);
      setText("");
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startSync() {
    reset();
    setReplace(false);
    setSyncStep("responses");
    setKind("responses");
    syncPreview("responses");
  }

  async function syncConfirm() {
    setBusy(true);
    setError("");
    try {
      // already previewed -> force apply; carry the replace choice on responses
      await sheetApi.sync(adminToken, opportunityId, syncStep, true, true, syncStep === "responses" ? replace : false);
      onImported?.();
      if (syncStep === "responses") {
        setSyncStep("shortlist");
        setKind("shortlist");
        await syncPreview("shortlist");
      } else {
        setApplied({ counts: {}, synced: true });
        setPreview(null);
        setSkipped(null);
        setSyncStep(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function skipSyncStep() {
    if (syncStep === "responses") {
      setSyncStep("shortlist");
      setKind("shortlist");
      await syncPreview("shortlist");
    } else {
      cancelSync();
    }
  }

  function cancelSync() {
    setSyncStep(null);
    setReplace(false);
    reset();
  }

  // Re-preview the responses step with replace toggled on/off.
  function toggleReplace(next) {
    setReplace(next);
    if (syncStep === "responses") syncPreview("responses", false, next);
  }

  const counts = preview?.counts || {};
  const problems = (preview?.rows || []).filter((row) => row.action === "skip");
  const inSync = Boolean(syncStep);

  return (
    <div className="panel wide">
      <div className="panel-title">
        <Upload size={20} />
        <h2>Import sheet data</h2>
        {!inSync && !preview ? (
          <div className="rsa-title-actions">
            <button type="button" className="rsa-link-btn" onClick={toggleLinks} disabled={busy}>
              <Link2 size={15} />
              Sheet links
            </button>
            <button type="button" className="rsa-sync-btn" onClick={startSync} disabled={busy}>
              {busy ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
              Sync from sheets
            </button>
          </div>
        ) : null}
      </div>
      <p className="rsa-hint">
        Pull the response and shortlist sheets straight from Google with <strong>Sync from sheets</strong>,
        or switch to a tab and paste. Either way you preview before anything is saved.
      </p>

      {showLinks && !inSync ? (
        <div className="rsa-links-editor">
          <p className="rsa-hint" style={{ marginTop: 0 }}>
            Fix a missing or wrong sheet URL here — no need to re-import the master sheet.
            Saving marks the link as changed; then <strong>Sync from sheets</strong> pulls it.
          </p>
          <label className="rsa-link-field">
            <span>Response sheet URL</span>
            <input
              type="url"
              value={respUrl}
              onChange={(e) => setRespUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/…"
              disabled={linkBusy}
            />
          </label>
          <label className="rsa-link-field">
            <span>Shortlist sheet URL</span>
            <input
              type="url"
              value={shortUrl}
              onChange={(e) => setShortUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/…"
              disabled={linkBusy}
            />
          </label>
          {linkMsg ? <div className="rsa-link-msg">{linkMsg}</div> : null}
          <div className="rsa-link-actions">
            <button type="button" className="back-button" onClick={toggleLinks} disabled={linkBusy}>
              Close
            </button>
            <button type="button" className="primary-button" onClick={saveLinks} disabled={linkBusy}>
              {linkBusy ? <Loader2 className="spin" size={15} /> : <Link2 size={15} />}
              Save links
            </button>
          </div>
        </div>
      ) : null}

      {[
        {
          label: "Response sheet",
          changed: changedSinceImport(opportunity?.response_sheet_changed_at, opportunity?.responses_imported_at),
          changedAt: opportunity?.response_sheet_changed_at,
          importedAt: opportunity?.responses_imported_at,
        },
        {
          label: "Shortlist sheet",
          changed: changedSinceImport(opportunity?.company_sheet_changed_at, opportunity?.shortlist_imported_at),
          changedAt: opportunity?.company_sheet_changed_at,
          importedAt: opportunity?.shortlist_imported_at,
        },
      ]
        .filter((item) => item.changed)
        .map((item) => (
          <div className="rsa-warning" key={item.label} style={{ marginBottom: 10 }}>
            <RefreshCw size={16} />
            <span>
              {item.label} link changed on {formatDate(item.changedAt)}
              {item.importedAt ? ` (last imported ${formatDate(item.importedAt)})` : ""}. Sync from
              sheets to pull the updated candidates.
            </span>
          </div>
        ))}

      {inSync ? (
        <div className="rsa-sync-steps">
          <span className={syncStep === "responses" ? "on" : "done"}>1 · Responses</span>
          <span className="rsa-sync-arrow">→</span>
          <span className={syncStep === "shortlist" ? "on" : ""}>2 · Shortlist</span>
        </div>
      ) : null}

      {!inSync ? (
        <div className="rsa-tabs">
          <button type="button" className={kind === "responses" ? "active" : ""} onClick={() => switchKind("responses")}>
            Student responses
          </button>
          <button type="button" className={kind === "shortlist" ? "active" : ""} onClick={() => switchKind("shortlist")}>
            Shortlist
          </button>
        </div>
      ) : null}

      {error ? <StatusMessage error={error} /> : null}

      {applied ? (
        <div className="status success" style={{ marginBottom: 12 }}>
          <BadgeCheck size={18} />
          <span>
            {applied.synced
              ? "Synced from Google Sheets."
              : `Imported ${applied.counts.rows} row(s): ${
                  kind === "responses"
                    ? `${applied.counts.applications_to_create} created, ${applied.counts.applications_to_update} updated, ${applied.counts.students_to_create} new students`
                    : `${applied.counts.applications_to_mark} marked shortlisted`
                }${applied.counts.status_preserved ? ` · ${applied.counts.status_preserved} kept their existing status` : ""}`}
          </span>
        </div>
      ) : null}

      {skipped ? (
        <div className="rsa-skip-banner">
          <ShieldCheck size={18} />
          <div className="rsa-skip-text">
            <strong>Already imported</strong>
            <p>
              {skipped.kind === "responses" ? "Responses were" : "The shortlist was"} already imported
              for this opening{skipped.already_imported_at ? ` on ${formatDate(skipped.already_imported_at)}` : ""}.
              Force only if you fixed a wrong or no-access sheet URL.
            </p>
          </div>
          <div className="rsa-skip-actions">
            <button type="button" className="back-button" onClick={() => syncPreview(syncStep, true)} disabled={busy}>
              <RefreshCw size={15} /> Force re-import
            </button>
            <button type="button" className="primary-button" onClick={skipSyncStep} disabled={busy}>
              {syncStep === "responses" ? "Skip to shortlist" : "Finish"}
            </button>
          </div>
        </div>
      ) : null}

      {busy && !preview && !skipped ? <PanelLoader /> : null}

      {!preview && !inSync ? (
        <>
          <textarea
            className="rsa-textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            placeholder={
              kind === "responses"
                ? "Paste the response sheet INCLUDING its header row (Timestamp, Student UID, Student Name, Email, Mobile Number, …)"
                : "Paste the shortlist sheet rows (Full Name, Email Id, … , Interested / Not Interested)"
            }
          />
          <div className="rsa-actions">
            <span className="muted">
              {text.trim() ? `${text.trim().split("\n").length} line(s)` : "Empty"}
            </span>
            <button className="primary-button" type="button" disabled={!text.trim() || busy} onClick={handlePreview}>
              {busy ? <Loader2 className="spin" size={18} /> : <Eye size={18} />}
              Preview changes
            </button>
          </div>
        </>
      ) : null}

      {preview?.blocked ? (
        <>
          <div className="rsa-warning" style={{ marginBottom: 12 }}>
            <TriangleAlert size={16} />
            <span>{preview.message}</span>
          </div>
          {preview.column_mapping ? <ColumnMapping mapping={preview.column_mapping} /> : null}
          {preview.detected_headers?.length ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Columns found in the sheet: {preview.detected_headers.join(", ")}
            </p>
          ) : null}
          <div className="rsa-actions" style={{ marginTop: 14 }}>
            <button className="back-button" type="button" onClick={inSync ? cancelSync : reset}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </>
      ) : preview ? (
        <>
          {preview.column_mapping ? <ColumnMapping mapping={preview.column_mapping} /> : null}

          <div className="rsa-detected">
            <div><span>Rows read</span><strong>{counts.rows ?? 0}</strong></div>
            {kind === "responses" ? (
              <>
                <div><span>Applications to create</span><strong>{counts.applications_to_create ?? 0}</strong></div>
                <div><span>To update</span><strong>{counts.applications_to_update ?? 0}</strong></div>
                <div><span>New students</span><strong>{counts.students_to_create ?? 0}</strong></div>
              </>
            ) : preview.has_remarks ? (
              <>
                <div><span>Shortlisted</span><strong>{counts.shortlisted ?? 0}</strong></div>
                <div><span>Not shortlisted</span><strong>{counts.not_shortlisted ?? 0}</strong></div>
                <div><span>Skipped</span><strong>{counts.unmatched ?? 0}</strong></div>
              </>
            ) : (
              <>
                <div><span>To mark shortlisted</span><strong>{counts.applications_to_mark ?? 0}</strong></div>
                <div><span>Matched by name</span><strong>{counts.matched_by_name ?? 0}</strong></div>
                <div>
                  <span>Not applied (skipped)</span>
                  <strong>{(counts.unmatched ?? 0) + (counts.ambiguous ?? 0)}</strong>
                </div>
              </>
            )}
          </div>

          {kind === "responses" && inSync ? (
            <label className="rsa-replace-toggle">
              <input
                type="checkbox"
                checked={replace}
                onChange={(event) => toggleReplace(event.target.checked)}
                disabled={busy}
              />
              <span>
                <strong>Replace candidates</strong> — remove applicants who aren&apos;t in this sheet
                (leftovers from an old or wrong sheet), including shortlisted ones, since they never
                really applied. All removals are backed up first. Only already-hired candidates
                (selected / offer / joined) are kept and flagged for review.
              </span>
            </label>
          ) : null}

          {replace && (counts.stale_removed || counts.stale_flagged) ? (
            <div className="rsa-warning" style={{ marginBottom: 10 }}>
              <TriangleAlert size={16} />
              <span>
                {counts.stale_removed || 0} stale candidate(s) will be removed (backed up first)
                {counts.stale_flagged
                  ? `, and ${counts.stale_flagged} already-hired candidate(s) will be flagged for review, not removed`
                  : ""}
                .
              </span>
            </div>
          ) : null}

          {preview.has_remarks && counts.selected_elsewhere ? (
            <p className="muted" style={{ marginBottom: 10 }}>
              {counts.selected_elsewhere} marked selected elsewhere (dropped).
            </p>
          ) : null}

          {counts.status_preserved ? (
            <div className="rsa-warning" style={{ marginBottom: 10 }}>
              <ShieldCheck size={16} />
              <span>
                {counts.status_preserved} student(s) are already past &quot;applied&quot; — their pipeline
                status will be kept, only their sheet details get refreshed.
              </span>
            </div>
          ) : null}

          {kind === "responses" && counts.students_to_create ? (
            <div className="rsa-warning" style={{ marginBottom: 10 }}>
              <TriangleAlert size={16} />
              <span>
                {counts.students_to_create} new student account(s) will be created. Their initial
                password is their mobile number.
              </span>
            </div>
          ) : null}

          {kind === "shortlist" && counts.unmatched ? (
            <div className="rsa-warning" style={{ marginBottom: 10 }}>
              <TriangleAlert size={16} />
              <span>
                {counts.unmatched} shortlisted name(s) never applied to this opening, so there is
                nothing to mark and they will be skipped. If they did apply, import that response
                sheet first and run this again.
              </span>
            </div>
          ) : null}

          {counts.matched_by_name ? (
            <div className="rsa-warning" style={{ marginBottom: 10 }}>
              <UserRound size={16} />
              <span>
                {counts.matched_by_name} row(s) had no email or phone and were matched by name
                against this opening&apos;s applicants. Check them in the table below.
              </span>
            </div>
          ) : null}

          {counts.ambiguous ? (
            <div className="rsa-warning" style={{ marginBottom: 10 }}>
              <TriangleAlert size={16} />
              <span>
                {counts.ambiguous} row(s) matched more than one applicant by name and will be
                skipped. Add an email column to the sheet to resolve them.
              </span>
            </div>
          ) : null}

          {preview.willing_breakdown ? (
            <p className="muted" style={{ marginBottom: 10 }}>
              Willing to join — interested: {preview.willing_breakdown.interested} · not interested:{" "}
              {preview.willing_breakdown.not_interested} · no response: {preview.willing_breakdown.no_response}
            </p>
          ) : null}

          {problems.length ? (
            <>
              <h3 className="detail-subhead">Rows that will be skipped ({problems.length})</h3>
              <div className="rsa-skiplist">
                {problems.map((row) => (
                  <div key={row.row}>
                    <strong>Row {row.row}{row.name ? ` · ${row.name}` : ""}</strong>
                    <span>{row.reason}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <h3 className="detail-subhead">What will happen</h3>
          <div className="rsa-preview-table">
            {(preview.rows || []).slice(0, 70).map((row, idx) => (
              <div className="rsa-preview-row" key={`${row.row}-${row.email || row.name || idx}`}>
                <span className="muted">{row.row}</span>
                <div>
                  <strong>{row.name || "(no name)"}</strong>
                  <span>{row.email || row.phone || "no contact"}</span>
                </div>
                <span
                  className={`status-pill ${
                    row.action === "skip" || row.action === "not_shortlisted" || row.action === "remove"
                      ? "bad"
                      : row.action === "selected_elsewhere" || row.action === "needs_review"
                        ? "warn"
                        : row.action.includes("create")
                          ? "neutral"
                          : "good"
                  }`}
                >
                  {row.action.replaceAll("_", " ")}
                </span>
                <span className="muted">
                  {row.matched_via === "name" ? <em>matched by name · </em> : null}
                  {row.action === "remove" || row.action === "needs_review"
                    ? row.reason
                    : row.remark
                      ? row.remark
                      : row.status_preserved_from
                        ? `keeps ${row.status_preserved_from}`
                        : row.status || row.willing_to_join || ""}
                </span>
              </div>
            ))}
            {(preview.rows || []).length > 70 ? (
              <p className="muted" style={{ padding: 10 }}>
                …and {preview.rows.length - 70} more rows.
              </p>
            ) : null}
          </div>

          {inSync ? (
            <div className="rsa-actions">
              <button className="back-button" type="button" onClick={cancelSync} disabled={busy}>
                <XCircle size={16} /> Cancel sync
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="back-button" type="button" onClick={skipSyncStep} disabled={busy}>
                  {syncStep === "responses" ? "Skip to shortlist" : "Finish"}
                </button>
                <button className="primary-button" type="button" onClick={syncConfirm} disabled={busy}>
                  {busy ? <Loader2 className="spin" size={18} /> : <BadgeCheck size={18} />}
                  {syncStep === "responses" ? "Confirm & continue" : "Confirm shortlist"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rsa-actions">
              <button className="back-button" type="button" onClick={reset} disabled={busy}>
                <ArrowLeft size={16} /> Back
              </button>
              <button className="primary-button" type="button" onClick={handleConfirm} disabled={busy}>
                {busy ? <Loader2 className="spin" size={18} /> : <BadgeCheck size={18} />}
                Confirm import
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

/* --- The panel that ties it together ------------------------------ */
function InterviewReportsPanel({ adminToken, opportunityId }) {
  const [stage, setStage] = useState("idle"); // idle | review | done
  const [rawText, setRawText] = useState("");
  const [proposal, setProposal] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [reports, setReports] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("reports");
  const [reused, setReused] = useState(false);

  async function refreshSide() {
    try {
      const [q, s] = await Promise.all([
        rsaApi.questions(adminToken, opportunityId),
        rsaApi.sessions(adminToken, opportunityId),
      ]);
      setQuestions(q || []);
      setSessions(s || []);
    } catch {
      /* side panels are best-effort */
    }
  }

  useEffect(() => {
    refreshSide();
  }, [opportunityId, adminToken]);

  async function loadReports(id) {
    const data = await rsaApi.reports(adminToken, id);
    setReports(data || []);
  }

  async function handlePropose(text) {
    setBusy(true);
    setError("");
    try {
      const result = await rsaApi.propose(adminToken, text, opportunityId);
      setRawText(text);
      setProposal(result);
      setStage("review");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(speakerMap) {
    if (!proposal?.company?.id || !proposal?.opportunity?.id) {
      setError("Could not resolve the company or opportunity for this transcript.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const confirmed = await rsaApi.confirm(adminToken, {
        raw_text: rawText,
        company_id: proposal.company.id,
        opportunity_id: proposal.opportunity.id,
        speaker_map: speakerMap,
        round_name: "Technical Round",
      });
      setReused(Boolean(confirmed.reused));
      setSessionId(confirmed.session_id);
      const result = await rsaApi.analyze(adminToken, confirmed.session_id);
      setAnalysis(result);
      await loadReports(confirmed.session_id);
      await refreshSide();
      setStage("done");
      setTab("reports");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openSession(id) {
    setBusy(true);
    setError("");
    try {
      setSessionId(id);
      await loadReports(id);
      setAnalysis(null);
      setStage("done");
      setTab("reports");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSession(session) {
    const label = `${session.round_name || "Interview"} · ${session.students?.length || 0} candidates`;
    if (!window.confirm(
      `Delete this extraction (${label})?\n\nThis removes its transcript, extracted questions and reports. This cannot be undone.`
    )) return;
    setBusy(true);
    setError("");
    try {
      await rsaApi.deleteSession(adminToken, session.id);
      if (session.id === sessionId) reset();
      await refreshSide();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStage("idle");
    setProposal(null);
    setRawText("");
    setReports([]);
    setAnalysis(null);
    setError("");
    setReused(false);
  }

  return (
    <div className="panel wide">
      <div className="panel-title">
        <Mic size={20} />
        <h2>Interviews &amp; RSA Reports</h2>
        {sessions.length ? <span className="title-count">{sessions.length}</span> : null}
        {stage !== "idle" ? (
          <button type="button" className="back-button subtle" style={{ marginLeft: "auto" }} onClick={reset}>
            <Send size={15} /> New transcript
          </button>
        ) : null}
      </div>

      {error ? <StatusMessage error={error} /> : null}

      {stage === "idle" ? (
        <>
          <TranscriptUpload onPropose={handlePropose} busy={busy} />
          {sessions.length ? (
            <>
              <h3 className="detail-subhead">Previous interviews</h3>
              <div className="rsa-sessions">
                {sessions.map((session) => (
                  <div className="rsa-session" key={session.id}>
                    <button type="button" className="rsa-session-open" onClick={() => openSession(session.id)}>
                      <div>
                        <strong>{session.round_name || "Interview"}</strong>
                        <span>{session.students?.length || 0} candidates · {formatDate(session.scheduled_at)}</span>
                      </div>
                      <span className={`status-pill ${session.ai_status === "completed" ? "good" : "neutral"}`}>
                        {session.ai_status || "not started"}
                      </span>
                      <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      className="rsa-session-del"
                      title="Delete this extraction (transcript, questions, reports)"
                      onClick={() => handleDeleteSession(session)}
                      disabled={busy}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {stage === "review" && proposal?.existing_session ? (
        <div className="rsa-warning" style={{ marginBottom: 12 }}>
          <TriangleAlert size={16} />
          <span>
            This transcript was already extracted for this opening
            {proposal.existing_session.ai_status ? ` (${proposal.existing_session.ai_status})` : ""}. Confirming
            will <strong>overwrite that same session</strong>, not create a duplicate.{" "}
            <button type="button" className="link-button" onClick={() => openSession(proposal.existing_session.session_id)}>
              Open the existing report instead
            </button>{" "}(no AI re-run).
          </span>
        </div>
      ) : null}

      {stage === "review" && proposal ? (
        <ProposalReview
          proposal={proposal}
          shortlist={proposal.shortlisted_students || []}
          onBack={reset}
          onConfirm={handleConfirm}
          busy={busy}
        />
      ) : null}

      {stage === "done" ? (
        <>
          {analysis ? (
            <div className="status success" style={{ marginBottom: 14 }}>
              <BadgeCheck size={18} />
              <span>
                {reused ? "Re-ran the existing session (no duplicate created) — " : ""}
                Analysed {analysis.candidates_analyzed} candidate(s), extracted {analysis.questions_extracted} questions
                {analysis.model ? ` · ${analysis.model}` : ""}
              </span>
            </div>
          ) : null}

          <div className="rsa-tabs">
            <button type="button" className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>
              Student feedback ({reports.length})
            </button>
            <button type="button" className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}>
              Questions asked ({questions.length})
            </button>
          </div>

          {busy ? <PanelLoader /> : null}

          {!busy && tab === "reports" ? (
            reports.length ? (
              <div className="rsa-reports scrollable" data-scroll-key="opp-reports">
                {reports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    adminToken={adminToken}
                    onChanged={() => loadReports(sessionId)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state compact"><p>No reports for this session.</p></div>
            )
          ) : null}

          {!busy && tab === "questions" ? <QuestionsPanel questions={questions} /> : null}
        </>
      ) : null}
    </div>
  );
}

function OpportunityDetail({ detail, adminToken, opportunityId, onRefresh }) {
  const [searchStudent, setSearchStudent] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [applicantsOpen, setApplicantsOpen] = useState(true);

  const o = detail.opportunity || {};
  const stats = detail.stats || {};
  const applicants = detail.applicants || [];

  // Build the status filter from the statuses that actually appear, using the
  // real (uppercase) current_status values so the option matches the data.
  const statusOptions = useMemo(
    () => Array.from(new Set(applicants.map((a) => String(a.status || "").toUpperCase()).filter(Boolean))).sort(),
    [applicants]
  );

  const filteredApplicants = applicants.filter((applicant) => {
    const student = applicant.student || {};
    const searchLower = searchStudent.toLowerCase();
    const matchesSearch =
      (student.name || "").toLowerCase().includes(searchLower) ||
      (student.phone || "").includes(searchStudent) ||
      (student.email || "").toLowerCase().includes(searchLower);
    const matchesStatus = filterStatus === "all" || String(applicant.status || "").toUpperCase() === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const keyFacts = [
    ["Role", o.role],
    ["Must-have skills", o.must_have_skills],
    ["Good-to-have skills", o.good_to_have_skills],
    ["Stipend", o.stipend],
    ["Location", o.location],
    ["Duration", o.duration],
    ["Day & timings", o.day_timings],
    ["Positions", o.positions],
    ["CRM POC", o.crm_poc],
    ["Student-side status", o.student_side_status],
    ["Received", o.opportunity_received_on || (o.opportunity_received_at ? formatDate(o.opportunity_received_at) : null)],
    ["Received time", o.received_time],
  ];

  const pipeline = [
    ["Profiles requested", o.profiles_requested],
    ["Profiles shared", o.profiles_shared],
    ["Mapping pool", o.mapping_pool],
    ["Eligible (as per pref)", o.eligible_as_per_pref],
    ["Filled form", o.filled_form_count],
    ["Interested", o.interested_count],
    ["Shortlists (CRM)", o.shortlists_count],
    ["Date of sharing profiles", o.date_of_sharing_profiles],
  ];

  const process = [
    ["Process date/time", o.process_datetime],
    ["Screening / telephonic", o.screening_round],
    ["Assignment round", o.assignment_round],
    ["TR 1", o.tr_1],
    ["Next process", o.next_process],
    ["Interview process", o.interview_process],
    ["Scheduled date", o.scheduled_date],
  ];

  const notes = [
    ["Company feedback", o.company_feedback],
    ["Process details", o.process_details],
    ["Action items", o.action_items],
    ["Hiring intelligence", o.hiring_intelligence],
    ["RSA notes", o.rsa_notes],
  ].filter(([, value]) => Boolean(value));

  const links = [
    ["Company sheet", o.company_sheet],
    ["Student response sheet", o.student_response_sheet],
    ["HubSpot", o.hubspot_link],
  ].filter(([, href]) => href && String(href).startsWith("http"));

  return (
    <>
      <section className="stats-grid admin-stats">
        <Metric icon={<UsersRound size={20} />} label="Applied" value={stats.applied_count ?? 0} />
        <Metric icon={<BadgeCheck size={20} />} label="Shortlisted" value={stats.shortlisted_count ?? 0} />
        <Metric icon={<XCircle size={20} />} label="Rejected" value={stats.rejected_count ?? 0} />
        <Metric icon={<BarChart3 size={20} />} label="Responses" value={stats.response_count ?? 0} />
      </section>

      <section className="content-grid admin-grid">
        <div className="panel wide">
          <div className="panel-title">
            <FileText size={20} />
            <h2>{o.role || "Opportunity"}</h2>
            {o.company_status ? (
              <span className={`status-pill ${companyStatusClass(o.company_status)}`}>{o.company_status}</span>
            ) : null}
          </div>

          <DetailGroup title="Key facts" fields={keyFacts} />
          <DetailGroup title="CRM pipeline" fields={pipeline} />
          <DetailGroup title="Process & rounds" fields={process} />

          {notes.length ? (
            <div className="notes-stack">
              {notes.map(([label, value]) => (
                <div className="detail-note" key={label}>
                  <strong>{label}</strong>
                  <p>{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {links.length ? (
            <div className="detail-links">
              {links.map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" title={label} className="icon-link">
                  {getLinkIcon(label)}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="panel wide">
          <button
            type="button"
            className="panel-title collapsible"
            onClick={() => setApplicantsOpen((value) => !value)}
            aria-expanded={applicantsOpen}
          >
            <UsersRound size={20} />
            <h2>Applicants</h2>
            <span className="title-count">{filteredApplicants.length}</span>
            <span className="panel-toggle">
              {applicantsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>

          {applicantsOpen && applicants.length > 0 && (
            <div className="applicants-controls">
              <div className="search-field">
                <input
                  type="text"
                  placeholder="Search by student name, phone, or email..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="controls-row">
                <div className="filter-controls">
                  <label>Filter by status:</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="sort-select">
                    <option value="all">All Status</option>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{statusMeta(s).label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {applicantsOpen ? (
            filteredApplicants.length ? (
              <div className="admin-table applicants-table scrollable" data-scroll-key="applicants">
                <div className="admin-head">
                  <span>Student</span>
                  <span>Status</span>
                  <span>Applied</span>
                  <span>Links</span>
                </div>
                {filteredApplicants.map((applicant) => (
                  <ApplicantRow key={applicant.id} application={applicant} />
                ))}
              </div>
            ) : (
              <div className="empty-state compact"><p>{searchStudent ? "No applicants match your search." : "No applicants yet."}</p></div>
            )
          ) : null}
        </div>

        {adminToken && opportunityId ? (
          <>
            <SheetImportPanel
              adminToken={adminToken}
              opportunityId={opportunityId}
              opportunity={o}
              onImported={onRefresh}
            />
            <InterviewReportsPanel adminToken={adminToken} opportunityId={opportunityId} />
          </>
        ) : null}
      </section>
    </>
  );
}

function ApplicantRow({ application }) {
  const student = application.student || {};
  const links = [
    ["Resume", application.resume_link],
    ["Project", application.project_link],
    ["GitHub", application.github_link],
  ].filter(([, href]) => Boolean(href));

  return (
    <div className="admin-row applicants-row">
      <div>
        <strong>{student.name || "Student"}</strong>
        <span>{student.phone || student.email || "Contact not added"}</span>
      </div>
      <div>
        <span className={`status-pill ${statusClass(application.status)}`}>{formatStatus(application.status)}</span>
      </div>
      <div>
        <span>{formatDate(application.applied_at)}</span>
      </div>
      <div className="link-group">
        {links.length ? (
          links.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" title={label} className="icon-link">
              {getLinkIcon(label)}
            </a>
          ))
        ) : (
          <span className="muted">No links</span>
        )}
      </div>
    </div>
  );
}

const EXPAND_LABELS = {
  all: "Applied companies",
  shortlisted: "Shortlisted companies",
  not_shortlisted: "Not shortlisted companies",
};
const EXPAND_PREVIEW = 3;

function listForMode(student, mode) {
  if (mode === "shortlisted") return student.shortlisted_applications || [];
  if (mode === "not_shortlisted") return student.not_shortlisted_applications || [];
  return student.applications || [];
}

function AdminStudentsView({ students, loading, navigate = () => {} }) {
  const [expanded, setExpanded] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");

  if (loading) return <PanelLoader />;

  function toggle(student, mode) {
    setShowAll(false);
    setExpanded((current) =>
      current && current.id === student.id && current.mode === mode ? null : { id: student.id, mode },
    );
  }

  function countButton(student, mode, count, variant) {
    const isActive = expanded && expanded.id === student.id && expanded.mode === mode;
    return (
      <button
        type="button"
        className={`table-count ${variant} ${isActive ? "active" : ""}`.trim()}
        disabled={!count}
        onClick={() => toggle(student, mode)}
      >
        {count ?? 0}
      </button>
    );
  }

  // Filter students based on search
  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (student.name || "").toLowerCase().includes(searchLower) ||
      (student.phone || "").includes(searchTerm) ||
      (student.email || "").toLowerCase().includes(searchLower)
    );
  });

  // Sort students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === "name") {
      return (a.name || "").localeCompare(b.name || "");
    } else if (sortBy === "applied_asc") {
      return (a.application_count ?? 0) - (b.application_count ?? 0);
    } else if (sortBy === "applied_desc") {
      return (b.application_count ?? 0) - (a.application_count ?? 0);
    } else if (sortBy === "shortlisted_asc") {
      return (a.shortlisted_count ?? 0) - (b.shortlisted_count ?? 0);
    } else if (sortBy === "shortlisted_desc") {
      return (b.shortlisted_count ?? 0) - (a.shortlisted_count ?? 0);
    } else if (sortBy === "not_shortlisted_asc") {
      return (a.not_shortlisted_count ?? 0) - (b.not_shortlisted_count ?? 0);
    } else if (sortBy === "not_shortlisted_desc") {
      return (b.not_shortlisted_count ?? 0) - (a.not_shortlisted_count ?? 0);
    }
    return 0;
  });

  return (
    <section className="panel wide">
      <div className="panel-title">
        <UsersRound size={20} />
        <h2>All Students</h2>
        {students.length ? <span className="title-count">{sortedStudents.length}</span> : null}
      </div>

      {students.length > 0 && (
        <div className="students-controls">
          <div className="search-field">
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="controls-row">
            <div className="sort-controls">
              <label>Sort by:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                <option value="name">Name (A-Z)</option>
                <option value="applied_desc">Most Applied</option>
                <option value="applied_asc">Least Applied</option>
                <option value="shortlisted_desc">Most Shortlisted</option>
                <option value="shortlisted_asc">Least Shortlisted</option>
                <option value="not_shortlisted_desc">Most Not Shortlisted</option>
                <option value="not_shortlisted_asc">Least Not Shortlisted</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {sortedStudents.length ? (
        <div className="admin-table students-table scrollable" data-scroll-key="students">
          <div className="admin-head">
            <span>Student</span>
            <span>Applied</span>
            <span>Shortlisted</span>
            <span>Not Shortlisted</span>
          </div>
          {sortedStudents.map((student) => {
            const isOpen = expanded && expanded.id === student.id;
            const list = isOpen ? listForMode(student, expanded.mode) : [];
            const visible = showAll ? list : list.slice(0, EXPAND_PREVIEW);
            const hidden = list.length - visible.length;
            return (
              <React.Fragment key={student.id}>
                <div className="admin-row student-row">
                  <div>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => student.id && navigate(["admin", "student", student.id])}
                      title="View full profile"
                    >
                      {student.name || "Student"}
                    </button>
                    <span>{student.phone || student.email || "Contact not added"}</span>
                  </div>
                  {countButton(student, "all", student.application_count, "")}
                  {countButton(student, "shortlisted", student.shortlisted_count, "good")}
                  {countButton(student, "not_shortlisted", student.not_shortlisted_count, "warn")}
                </div>
                {isOpen ? (
                  <div className="student-expand">
                    <div className="student-expand-head">
                      <span>{EXPAND_LABELS[expanded.mode]}</span>
                      <button type="button" className="expand-close" onClick={() => setExpanded(null)} title="Close">
                        <XCircle size={16} />
                      </button>
                    </div>
                    {list.length ? (
                      <>
                        <div className="expand-list">
                          {visible.map((application) => (
                            <ExpandCompanyRow key={application.id} application={application} />
                          ))}
                        </div>
                        {list.length > EXPAND_PREVIEW ? (
                          <button type="button" className="expand-toggle" onClick={() => setShowAll((value) => !value)}>
                            {showAll ? "Show less" : `Show ${hidden} more`}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p className="expand-empty">No companies to show here.</p>
                    )}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="empty-state compact"><p>{searchTerm ? "No students match your search." : "No students found."}</p></div>
      )}
    </section>
  );
}

function ExpandCompanyRow({ application }) {
  const links = [
    ["Resume", application.resume_link],
    ["Project", application.project_link],
    ["GitHub", application.github_link],
  ].filter(([, href]) => Boolean(href));

  return (
    <div className="expand-row">
      <div className="expand-company">
        <strong>{application.company?.name || "Company"}</strong>
        <span>{application.opportunity?.role || "Role not mapped"}</span>
      </div>
      <div className="expand-status">
        <span className={`status-pill ${statusClass(application.status)}`}>{formatStatus(application.status)}</span>
        <span className="date-line">
          <CalendarClock size={13} />
          {formatDate(application.applied_at)}
        </span>
      </div>
      <div className="link-group">
        {links.length ? (
          links.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" title={label} className="icon-link">
              {getLinkIcon(label)}
            </a>
          ))
        ) : (
          <span className="muted">No links</span>
        )}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Date not added";
  return new Date(value).toLocaleDateString();
}

function Metric({ icon, label, value, onClick }) {
  const Component = onClick ? "button" : "div";
  return (
    <Component className={onClick ? "metric metric-button" : "metric"} type={onClick ? "button" : undefined} onClick={onClick}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </Component>
  );
}

createRoot(document.getElementById("root")).render(<App />);
