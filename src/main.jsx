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
  Maximize2,
  Wand2,
  Pencil,
  X,
} from "lucide-react";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const ACCESS_TOKEN_KEY = "rsa_student_access_token";
const ADMIN_TOKEN_KEY = "rsa_admin_token";
const APPLICATION_STATUS_OPTIONS = [
  "APPLIED", "PROFILE_SHARED", "SHORTLISTED", "NOT_SHORTLISTED",
  "INTERVIEW_SCHEDULED", "INTERVIEW_IN_PROGRESS", "INTERVIEW_COMPLETED",
  "INTERVIEW_NOT_ATTENDED", "SELECTED", "OFFER_PENDING", "OFFER_RELEASED",
  "OFFER_ACCEPTED", "OFFER_REJECTED", "JOINED", "REJECTED", "DROPPED",
];

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
    const err = new Error(formatApiError(data) || "Something went wrong");
    err.data = data;
    err.status = response.status;
    throw err;
  }

  return data;
}

function formatApiError(data) {
  const detail = data?.detail;
  if (Array.isArray(detail)) {
    const lines = detail.map((item) => {
      const location = Array.isArray(item?.loc)
        ? item.loc.filter((part) => part !== "body").map((part, index, parts) =>
          typeof part === "number" ? `[${part}]` : index && typeof parts[index - 1] === "number" ? `.${part}` : String(part)
        ).join("")
        : "Request";
      return `${location || "Request"}: ${item?.msg || "Invalid value"}`;
    });
    return `Manual analysis validation failed:\n${lines.map((line) => `• ${line}`).join("\n")}`;
  }
  if (typeof detail === "string") return detail;
  if (typeof data?.message === "string") return data.message;
  return "";
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
                placeholder="Mobile number"
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
    api.get(`/practice-questions?${params.toString()}`)
      .then((result) => live && setData(result))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [api, includeScenario, category, company, difficulty, search]);

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
        <p>Notes from your interviews — what went well, and what to fix before the next one.</p>
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

function StudentPracticeView({ api }) {
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
    case "rejected":
      return { key: "not_shortlisted", label: "Rejected", cls: "bad" };
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

// Section labels are user-facing only. `key` still matches the bucket key derived
// from studentStatusInfo(), so the underlying status values are untouched:
// "not_shortlisted" is displayed as "Next Steps" but stored/derived exactly as before.
// `subText`, when present, replaces the default "<count> <sub>" summary line.
const SD_GROUPS = [
  { key: "interviewing", title: "Interviewing", chipLabel: "Now", chipCls: "warn", sub: "feedback may be ready" },
  { key: "shortlisted", title: "Shortlisted", chipLabel: "Good news", chipCls: "good", sub: "companies want to talk to you" },
  { key: "applied", title: "Applied · waiting to hear back", chipLabel: "Waiting", chipCls: "neutral", sub: "companies" },
  {
    key: "not_shortlisted",
    title: "Next Steps",
    chipLabel: "Next",
    chipCls: "neutral",
    sub: "to learn from",
    subText: "These opportunities didn't move forward this time — use the feedback to prepare for the next one.",
  },
  { key: "declined", title: "Not interested", chipLabel: "Closed", chipCls: "muted", sub: "you declined" },
];

// Target number of complete cards when there is room for them.
const SD_VISIBLE_CARDS = 4;
// Floor for a constrained list. A section low in the column, or a short screen,
// can leave less room than this — the list still stops here rather than growing
// unbounded, and the page scrolls the last card or two into view naturally.
const SD_MIN_CARDS = 2;
// Breathing room kept below an open list so it never runs into the viewport edge.
const SD_LIST_BOTTOM_GAP = 24;

// Single source of truth for what is known about an application. The collapsed
// card's meta line and the expanded detail popup are both built from these, so a
// field can never show in one view and go missing from the other. Nothing here is
// derived or invented — every value already exists on the application payload.
const SD_APP_LINKS = [
  ["Resume", "resume_link", FileText],
  ["Project", "project_link", Code],
  ["GitHub", "github_link", Github],
];

function sdAppLinks(app) {
  return SD_APP_LINKS.map(([label, key, Icon]) => [label, app[key], Icon]).filter(([, href]) => Boolean(href));
}

function sdAppFacts(app) {
  const opp = app.opportunity || {};
  return [
    ["Location", opp.location],
    ["Stipend", opp.stipend],
    ["Duration", opp.duration],
    ["Applied", app.applied_at ? formatDate(app.applied_at) : null],
    ["Skills", opp.tech_stack || opp.must_have_skills],
  ].filter(([, value]) => Boolean(value));
}

// The card's one-line summary, rendered from the same facts the popup lists.
function sdAppMetaLine(app) {
  return sdAppFacts(app)
    .filter(([label]) => label !== "Skills")
    // only Stipend and Applied carry their label inline, exactly as before
    .map(([label, value]) => (label === "Stipend" || label === "Applied" ? `${label} ${value}` : value))
    .join(" · ");
}

// The application card. Hoisted to module scope so it keeps a stable component
// identity across StudentDashboard re-renders — a card that remounts would reset
// the scroll position of the list it sits in.
function SdAppCard({ app, report, onOpenReport, onExpand }) {
  const info = studentStatusInfo(app);
  const opp = app.opportunity || {};
  const links = sdAppLinks(app);
  const meta = sdAppMetaLine(app);
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
            <button type="button" className="sd-read-fb" onClick={() => onOpenReport(report.id)}>
              <FileText size={14} /> Read feedback
            </button>
          ) : null}
          {onExpand ? (
            <button
              type="button"
              className="sd-app-expand"
              aria-label={`View application details for ${app.company?.name || "this company"}`}
              title="View application details"
              onClick={() => onExpand(app)}
            >
              <Maximize2 size={16} />
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

// The scroll region shared by every accordion section. It sizes itself from two
// live measurements rather than any fixed pixel value: the real height of the
// cards, and the space actually left below the list in the viewport. It then cuts
// on a card boundary — SD_VISIBLE_CARDS where there is room, fewer on a short
// screen, and not at all when even SD_MIN_CARDS will not fit (there the page just
// flows). A card is therefore never sliced in half at any viewport size.
function SdScrollList({ scrollKey, itemCount, children }) {
  const listRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(null);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || itemCount <= SD_VISIBLE_CARDS) {
      setMaxHeight(null);
      return undefined;
    }
    const measure = () => {
      const cards = Array.from(el.children);
      if (cards.length <= SD_VISIBLE_CARDS) {
        setMaxHeight(null);
        return;
      }
      const cs = window.getComputedStyle(el);
      const padBottom = parseFloat(cs.paddingBottom) || 0;
      const rect = el.getBoundingClientRect();

      // Height of the list if it were cut just under card i. Read off live layout
      // rather than summed, so it picks up the container border, top padding, row
      // gaps, and any card taller than its neighbours. Adding padding-bottom lands
      // the cut inside the gap before card i+1, so nothing peeks through.
      const edgeAfter = (i) =>
        cards[i].getBoundingClientRect().bottom - rect.top + el.scrollTop + padBottom;

      // Space between the top of the list and the bottom of the viewport, measured
      // from the document so it does not drift as the page scrolls.
      const available = window.innerHeight - (rect.top + window.scrollY) - SD_LIST_BOTTOM_GAP;
      const ideal = edgeAfter(SD_VISIBLE_CARDS - 1);

      let next;
      if (available >= ideal) {
        // Room for the full target: show exactly SD_VISIBLE_CARDS.
        next = ideal;
      } else {
        // Tighter spot — a short screen, or a section sitting low in the column.
        // Step down to the last card that still fits whole, but never below the
        // SD_MIN_CARDS floor: an unconstrained list here is what makes the page
        // grow without bound, which is the thing this is here to prevent.
        let fits = -1;
        for (let i = 0; i < cards.length; i += 1) {
          if (edgeAfter(i) <= available) fits = i; else break;
        }
        next = edgeAfter(Math.max(fits, SD_MIN_CARDS - 1));
      }

      const rounded = Math.round(next);
      setMaxHeight((prev) => (prev === rounded ? prev : rounded));
    };
    measure();
    // Re-measure when the viewport changes: available space drives the height.
    window.addEventListener("resize", measure);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      // Observe the cards, not the container: measuring off the container would
      // feed its own max-height back into the observer.
      ro = new ResizeObserver(measure);
      Array.from(el.children).forEach((card) => ro.observe(card));
    }
    return () => {
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [itemCount, children]);

  // Whether the list will scroll is known from the item count alone, so the
  // scroll styling (and with it the reserved scrollbar gutter) is applied on the
  // first render — before measuring. Measuring at the final content width matters:
  // reserving the gutter afterwards would re-wrap the card text, make the cards
  // taller, and leave the height we just computed cutting through a card.
  const scrolls = itemCount > SD_VISIBLE_CARDS;
  return (
    <div
      ref={listRef}
      className={`sd-group-body${scrolls ? " is-scroll" : ""}`}
      data-scroll-key={scrolls ? scrollKey : undefined}
      style={maxHeight == null ? undefined : { "--sd-list-max": `${maxHeight}px` }}
    >
      {children}
    </div>
  );
}

// The expanded view of one application card. It shows the same fields the card is
// built from (via sdAppFacts / sdAppLinks) with room to display them in full, so
// it reads as the same card opened up rather than a different screen.
function SdAppDetailModal({ app, report, onOpenReport, onClose }) {
  const info = studentStatusInfo(app);
  const opp = app.opportunity || {};
  const facts = sdAppFacts(app);
  const links = sdAppLinks(app);
  return (
    <SdModal wide title={app.company?.name || "Company"} onClose={onClose}>
      <div className="sd-detail-head">
        <p className="sd-detail-role">{opp.role || "Role not mapped"}</p>
        <span className={`sd-pill ${info.cls}`}>{info.label}</span>
      </div>

      <dl className="sd-detail-facts">
        {facts.map(([label, value]) => (
          <div className="sd-detail-fact" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {app.screening_remark ? (
        <div className="sd-remark">
          <AlertCircle size={15} />
          <p><strong>Note from the company</strong> — {app.screening_remark}</p>
        </div>
      ) : null}

      {links.length ? (
        <div className="sd-detail-links">
          {links.map(([label, href, Icon]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer">
              <Icon size={15} /> {label}
            </a>
          ))}
        </div>
      ) : null}

      {report ? (
        <button
          type="button"
          className="sd-btn-soft"
          onClick={() => {
            onClose();
            onOpenReport(report.id);
          }}
        >
          <FileText size={15} /> Read feedback
        </button>
      ) : (
        <p className="sd-empty-note">Interview feedback will appear here once it is published.</p>
      )}
    </SdModal>
  );
}

// Centred popup used for panels that do not earn permanent dashboard space.
// Closes on the X, on a backdrop click and on Escape; the body scrolls internally
// so long content never grows the dialog past the viewport.
function SdModal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="sd-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`sd-modal${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sd-modal-head">
          <h3>{title}</h3>
          <button type="button" className="sd-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="sd-modal-body">{children}</div>
      </div>
    </div>
  );
}

// One accordion section. Every section renders through this, so the header, the
// caret and the scroll behaviour live in a single place.
function SdAccordionSection({ group, items, open, onToggle, renderItem }) {
  return (
    <div className="sd-group">
      <button type="button" className="sd-group-head" aria-expanded={open} onClick={onToggle}>
        <span className={`sd-chip ${group.chipCls}`}>{group.chipLabel}</span>
        <span className="sd-group-heading">
          <span className="sd-group-title">{group.title}</span>
          <span className="sd-group-sub">{group.subText || `${items.length} ${group.sub}`}</span>
        </span>
        <span className="sd-caret">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
      </button>
      {open ? (
        <SdScrollList scrollKey={`sd-group-${group.key}`} itemCount={items.length}>
          {items.map(renderItem)}
        </SdScrollList>
      ) : null}
    </div>
  );
}

function StudentIssuesView({ api }) {
  const [issues, setIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenBusy, setReopenBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api.get("/issues")
      .then((data) => current && setIssues(data || []))
      .catch((err) => current && setError(err.message))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [api]);

  async function openIssue(issue) {
    setError("");
    try {
      // An admin preview lists the issues but has no per-issue route: the row
      // already carries what the detail shows.
      setSelectedIssue(api.preview ? issue : await api.get(`/issues/${issue.id}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function reopenIssue() {
    if (!selectedIssue || api.preview) return;
    setReopenBusy(true);
    setError("");
    try {
      const updated = await api.post(`/issues/${selectedIssue.id}/reopen`);
      setSelectedIssue(updated);
      setIssues((items) => items.map((issue) => issue.id === updated.id ? { ...issue, ...updated } : issue));
      setReopenOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setReopenBusy(false);
    }
  }

  if (loading) return <PanelLoader />;

  return (
    <div className="sd-view-head">
      <h2>My Issues &amp; Feedback</h2>
      <p>Track the issues and feedback you have submitted.</p>
      {error ? <StatusMessage error={error} /> : null}
      {selectedIssue ? (
        <section className="sd-card" style={{ marginTop: 18 }}>
          <button type="button" className="back-button" onClick={() => setSelectedIssue(null)}>
            <ArrowLeft size={16} /> Back to my issues
          </button>
          <h3>{selectedIssue.title}</h3>
          <p className="sd-app-meta">{selectedIssue.category} · Created {formatDate(selectedIssue.created_at)}</p>
          <span className={`sd-pill ${selectedIssue.status === "CLOSED" ? "good" : "warn"}`}>{selectedIssue.status === "CLOSED" ? "CLOSED" : "IN PROGRESS"}</span>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 16 }}>{selectedIssue.description}</p>
          <p className="sd-app-meta">Last updated: {selectedIssue.updated_at ? formatDate(selectedIssue.updated_at) : "Not available"}</p>
          {selectedIssue.status === "CLOSED" ? (
            <button
              type="button"
              className="sd-btn-primary"
              disabled={api.preview}
              title={api.preview ? "Read-only preview — an admin can't reopen an issue as this student" : undefined}
              onClick={() => setReopenOpen(true)}
            >
              <RefreshCw size={16} /> <span>Reopen Issue</span>
            </button>
          ) : null}
        </section>
      ) : issues.length ? (
        <div className="sd-groups" style={{ marginTop: 18 }}>
          {issues.map((issue) => (
            <button type="button" className="sd-card" key={issue.id} onClick={() => openIssue(issue)} style={{ width: "100%", textAlign: "left", border: 0, font: "inherit", cursor: "pointer" }}>
              <div className="sd-card-head"><strong>{issue.title}</strong><span className={`sd-pill ${issue.status === "CLOSED" ? "good" : "warn"}`}>{issue.status === "CLOSED" ? "CLOSED" : "IN PROGRESS"}</span></div>
              <p className="sd-app-meta">{issue.category} · Created {formatDate(issue.created_at)}{issue.updated_at ? ` · Updated ${formatDate(issue.updated_at)}` : ""}</p>
              <p className="sd-empty-note">{issue.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="sd-card" style={{ marginTop: 18 }}><p className="sd-empty-note">You have not submitted any issues yet.</p></div>
      )}
      {reopenOpen ? (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1100, display: "grid", placeItems: "center", padding: 16, background: "rgba(16, 24, 40, 0.45)" }}>
          <div className="sd-card" style={{ width: "min(420px, 100%)" }} onClick={(event) => event.stopPropagation()}>
            <h3>Reopen this issue?</h3>
            <p>This issue is currently closed. Would you like to reopen it?</p>
            <div className="rsa-actions">
              <button type="button" className="back-button" onClick={() => setReopenOpen(false)} disabled={reopenBusy}>Cancel</button>
              <button type="button" className="sd-btn-primary" onClick={reopenIssue} disabled={reopenBusy}>{reopenBusy ? "Reopening..." : "Reopen"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* An admin looking at one student sees the student's own dashboard - the same
 * components, the same payloads, the same full-window dimensions - instead of a
 * second rendering of the same data that drifts from what the student reports.
 * Read-only: the actions that would write as the student are disabled. */
function AdminStudentPreview({ adminToken, studentId, onExit }) {
  const [student, setStudent] = useState(null);
  const [error, setError] = useState("");
  // The student's own tab navigation, kept in memory: the admin URL stays put.
  const [section, setSection] = useState("");
  const source = useMemo(() => studentSource({ adminToken, studentId }), [adminToken, studentId]);

  useEffect(() => {
    let live = true;
    setError("");
    setStudent(null);
    source.get("/profile")
      .then((data) => live && setStudent(data))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [source]);

  if (error || !student) {
    return (
      <main className="dashboard-shell sd-shell">
        <section className="dashboard-main">
          <header className="topbar">
            <button type="button" className="back-button" onClick={onExit}>
              <ArrowLeft size={17} /> Back to admin
            </button>
          </header>
          {error ? <StatusMessage error={error} /> : <PanelLoader />}
        </section>
      </main>
    );
  }

  return (
    <StudentDashboard
      student={student}
      source={source}
      onExitPreview={onExit}
      route={["student", section]}
      navigate={(next) => setSection(next[1] || "")}
    />
  );
}

/* Where the student screens read their data from.
 *
 * A student reads their own: /students/me/<path> with their token. An admin
 * previewing a student reads the very same payloads through read-only admin
 * routes, so the admin sees the student's screen rather than a second rendering
 * of the same data that can drift from it. */
function studentSource({ token, adminToken, studentId }) {
  if (studentId) {
    return {
      preview: true,
      get: (path) => apiRequest(`/admin/students/${studentId}/view${path}`, { adminToken }),
    };
  }
  return {
    preview: false,
    get: (path) => apiRequest(`/students/me${path}`, { token }),
    post: (path, body) => apiRequest(`/students/me${path}`, { method: "POST", token, body }),
  };
}

function StudentDashboard({
  student, token, onLogout, route = [], navigate = () => {},
  // Admin preview passes a source reading the same payloads read-only, and
  // renders the shell full width so the dimensions match the student's.
  source, onExitPreview,
}) {
  const api = useMemo(() => source || studentSource({ token }), [source, token]);
  const preview = Boolean(api.preview);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  // #/student/feedback and #/student/practice survive a refresh.
  const view =
    route[1] === "feedback" ? "reports" : route[1] === "practice" ? "practice" : route[1] === "issues" ? "issues" : "dashboard";
  const setView = useCallback(
    (next) => {
      const seg = next === "reports" ? "feedback" : next === "practice" ? "practice" : next === "issues" ? "issues" : "";
      navigate(["student", seg]);
    },
    [navigate],
  );
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [focusReportId, setFocusReportId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueCategory, setIssueCategory] = useState("BUG");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueBusy, setIssueBusy] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueSuccess, setIssueSuccess] = useState("");
  // One shared accordion slot: exactly one detail section is open at a time, and
  // null means every section starts closed.
  const [activeSection, setActiveSection] = useState(null);
  // Opening a section is a pure state change — no scrolling, no viewport movement.
  const [fixOpen, setFixOpen] = useState(false);
  // Held separately from activeSection, so expanding a card cannot disturb which
  // accordion is open or where the page is scrolled.
  const [detailApp, setDetailApp] = useState(null);

  useEffect(() => {
    let isCurrent = true;
    setLoadingDashboard(true);
    setDashboardError("");
    api.get("/dashboard")
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
  }, [api]);

  // Published reports drive both the Feedback column and the reports view.
  useEffect(() => {
    let isCurrent = true;
    setLoadingReports(true);
    api.get("/reports")
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
  }, [api]);

  const reportByApplication = useMemo(() => {
    const map = {};
    reports.forEach((report) => {
      if (report.application_id) map[report.application_id] = report;
    });
    return map;
  }, [reports]);

  const openReport = useCallback((reportId) => {
    setFocusReportId(reportId);
    setView("reports");
  }, [setView]);

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

  // Header click: open a closed section, close the open one.
  function toggleSection(key) {
    setActiveSection((prev) => (prev === key ? null : key));
  }

  // Top summary click: activate the matching section in place. The viewport is
  // never moved — the dashboard just changes state where it stands.
  function openSectionFromSummary(key) {
    setActiveSection(key);
  }

  function closeIssue() {
    setIssueOpen(false);
    setIssueTitle("");
    setIssueCategory("BUG");
    setIssueDescription("");
    setIssueError("");
  }

  async function submitIssue(event) {
    event.preventDefault();
    if (!issueTitle.trim() || !issueDescription.trim()) {
      setIssueError("Title and description are required.");
      return;
    }
    setIssueBusy(true);
    setIssueError("");
    try {
      await api.post("/issues", {
        title: issueTitle.trim(),
        category: issueCategory,
        description: issueDescription.trim(),
      });
      closeIssue();
      setIssueSuccess("Issue submitted successfully. Thank you for helping us improve the application.");
    } catch (err) {
      setIssueError(err.message || "Could not submit the issue.");
    } finally {
      setIssueBusy(false);
    }
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
          <button type="button" className={view === "issues" ? "active" : ""} onClick={() => setView("issues")}>
            <CircleHelp size={18} /> My Issues &amp; Feedback
          </button>
        </nav>
        <div className="sd-side-foot">
          {shortlisted.length ? (
            <p className="sd-nudge">You're on {shortlisted.length} shortlist{shortlisted.length === 1 ? "" : "s"}. Keep the momentum going.</p>
          ) : null}
          {/* Same button, same place: an admin previewing leaves instead of
              logging the student out. */}
          <button className="ghost-button" onClick={preview ? onExitPreview : onLogout}>
            <LogOut size={18} /> {preview ? "Back to admin" : "Log out"}
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="topbar sd-topbar">
          <div>
            <h1>{greeting()}, {firstName} 👋</h1>
            {/* <p className="sd-header-sub">{headerSub}</p> */}
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={preview}
            title={preview ? "Read-only preview — an admin can't raise an issue as this student" : undefined}
            onClick={() => { setIssueOpen(true); setIssueSuccess(""); setIssueError(""); }}
          >
            <CircleHelp size={17} /> Report an Issue
          </button>
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

        {issueSuccess ? <StatusMessage message={issueSuccess} /> : null}

        {issueOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-issue-title"
            style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 16, background: "rgba(16, 24, 40, 0.42)" }}
          >
            <form onSubmit={submitIssue} className="panel" style={{ width: "min(520px, 100%)", margin: 0 }}>
              <div className="panel-title">
                <CircleHelp size={20} />
                <h2 id="student-issue-title">Report an Issue</h2>
              </div>
              <label className="rsa-link-field">
                <span>Title</span>
                <input className="search-input" value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} maxLength={200} required />
              </label>
              <label className="rsa-link-field">
                <span>Category</span>
                <select className="sort-select" value={issueCategory} onChange={(event) => setIssueCategory(event.target.value)}>
                  <option value="BUG">BUG</option>
                  <option value="APPLICATION">APPLICATION</option>
                  <option value="INTERVIEW">INTERVIEW</option>
                  <option value="FEEDBACK">FEEDBACK</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>
              <label className="rsa-link-field">
                <span>Description</span>
                <textarea className="rsa-textarea" value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} maxLength={5000} rows={6} required />
              </label>
              {issueError ? <StatusMessage error={issueError} /> : null}
              <div className="rsa-actions">
                <button type="button" className="back-button" onClick={closeIssue} disabled={issueBusy}>Cancel</button>
                <button type="submit" className="primary-button" disabled={issueBusy || !issueTitle.trim() || !issueDescription.trim()}>
                  {issueBusy ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                  {issueBusy ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {view === "issues" ? (
          <StudentIssuesView api={api} />
        ) : view === "reports" ? (
          <StudentReportsView reports={reports} loading={loadingReports} focusId={focusReportId} onPractice={() => setView("practice")} />
        ) : view === "practice" ? (
          <StudentPracticeView api={api} />
        ) :dashboardError ? (
          <StatusMessage error={dashboardError} />
        ) : loadingDashboard ? (
          <PanelLoader />
        ) : (
          <>
            <section className="sd-stage-bar">
              <div className="sd-stage-head">
                <h2>Where your {applications.length} application{applications.length === 1 ? "" : "s"} stand</h2>
                <span>Tap a stage to open it below</span>
              </div>
              <div className="sd-stages">
                {stages.map((stage) => {
                  // "Feedback ready" keeps its existing behaviour (it opens the
                  // feedback view, it is not an application-stage accordion).
                  const navigates = stage.key !== "feedback";
                  const isOpen = navigates && activeSection === stage.key;
                  return (
                    <button
                      type="button"
                      key={stage.key}
                      className={`sd-stage ${isOpen ? "on" : ""}`}
                      aria-expanded={navigates ? isOpen : undefined}
                      disabled={navigates && stage.count === 0}
                      onClick={() => (navigates ? openSectionFromSummary(stage.key) : setView("reports"))}
                    >
                      <span className="sd-stage-label">
                        <i style={{ background: stage.color }} /> {stage.label}
                      </span>
                      <span className="sd-stage-count">
                        <strong>{stage.count}</strong> {stage.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="sd-grid">
              <section className="sd-groups">
                {applications.length ? (
                  SD_GROUPS.map((g) => {
                    const items = groups[g.key];
                    if (!items.length) return null;
                    return (
                      <SdAccordionSection
                        key={g.key}
                        group={g}
                        items={items}
                        open={activeSection === g.key}
                        onToggle={() => toggleSection(g.key)}
                        renderItem={(app) => (
                          <SdAppCard
                            key={app.id}
                            app={app}
                            report={reportByApplication[app.id]}
                            onOpenReport={openReport}
                            onExpand={setDetailApp}
                          />
                        )}
                      />
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
                      <button type="button" className="sd-btn-soft sd-fix-trigger" onClick={() => setFixOpen(true)}>
                        <ListChecks size={16} /> Fix these first
                        <span className="sd-fix-count">{newestReport.improvements.length}</span>
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="sd-card">
                    <p className="sd-card-eyebrow">Interview coaching</p>
                    <p className="sd-empty-note">No feedback yet — once you interview, your coaching appears here. Until then, practice what your companies ask.</p>
                    <button type="button" className="sd-btn-soft" onClick={() => setView("practice")}>Practice questions</button>
                  </div>
                )}

              </aside>
            </div>

            {detailApp ? (
              <SdAppDetailModal
                app={detailApp}
                report={reportByApplication[detailApp.id]}
                onOpenReport={openReport}
                onClose={() => setDetailApp(null)}
              />
            ) : null}

            {fixOpen && newestReport?.improvements?.length ? (
              <SdModal title="Fix these first" onClose={() => setFixOpen(false)}>
                <div className="sd-fix-list">
                  {newestReport.improvements.map((imp, i) => (
                    <div className="sd-fix" key={i}>
                      <span className={`sd-prio ${imp.priority}`}>{imp.priority === "high" ? "High" : imp.priority === "medium" ? "Med" : imp.priority}</span>
                      <span>{imp.area}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="sd-btn-soft"
                  onClick={() => {
                    setFixOpen(false);
                    setView("practice");
                  }}
                >
                  Practice what you missed
                </button>
              </SdModal>
            ) : null}
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
  const KNOWN_VIEWS = ["students", "analytics", "student", "company", "reports", "issues"];
  const activeView = KNOWN_VIEWS.includes(route[1]) ? route[1] : "overview";
  const companyId = route[1] === "company" ? route[2] || null : null;
  const studentId = route[1] === "student" ? route[2] || null : null;
  // Opening a student shows their own dashboard; /details is the admin's own
  // view of them, with placement and status controls.
  const studentAdminDetails = route[1] === "student" && route[3] === "details";
  const routeOppId = route[3] === "opp" ? route[4] || null : null;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [issuesData, setIssuesData] = useState(null);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issueFilters, setIssueFilters] = useState({ status: "", category: "", sort: "newest" });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [filterByRole, setFilterByRole] = useState("all");
  const dashboardFetchId = useRef(0);

  function handleOverviewImport(result) {
    return loadDashboard();
  }

  function loadDashboard() {
    const fetchId = ++dashboardFetchId.current;
    setLoading(true);
    setError("");
    return apiRequest("/admin/dashboard", { adminToken })
      .then((data) => {
        if (fetchId === dashboardFetchId.current) setDashboard(data);
      })
      .catch((err) => {
        if (fetchId === dashboardFetchId.current) setError(err.message);
      })
      .finally(() => {
        if (fetchId === dashboardFetchId.current) setLoading(false);
      });
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

  function loadIssues(filters = issueFilters) {
    setLoadingIssues(true);
    setError("");
    const query = new URLSearchParams({ page: "1", limit: "50", ...filters });
    [...query.keys()].forEach((key) => { if (!query.get(key)) query.delete(key); });
    apiRequest(`/admin/issues?${query.toString()}`, { adminToken })
      .then(setIssuesData)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingIssues(false));
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
    if (activeView === "issues" && !issuesData && !loadingIssues) loadIssues();
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
      return (a.shortlists_count ?? 0) - (b.shortlists_count ?? 0);
    } else if (sortBy === "shortlisted_desc") {
      return (b.shortlists_count ?? 0) - (a.shortlists_count ?? 0);
    }
    return 0;
  });

  const overviewViews = ["overview", "queue", "companies", "reports"];

  // Rendered instead of the admin shell, not inside it: the student's dashboard
  // then gets the whole window, exactly as the student sees it.
  if (studentId && !studentAdminDetails) {
    return (
      <AdminStudentPreview
        adminToken={adminToken}
        studentId={studentId}
        onExit={() => navigate(["admin", "student", studentId, "details"])}
      />
    );
  }

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
          <button className={activeView === "issues" ? "active" : ""} type="button" onClick={() => navigate(["admin", "issues"])}>
            <CircleHelp size={18} /> Issues &amp; Feedback
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
        ) : activeView === "issues" ? (
          <>
            <header className="topbar">
              <div><p className="eyebrow">Admin Dashboard</p><h1>Issues &amp; Feedback</h1></div>
              <button className="icon-button" type="button" onClick={loadIssues} disabled={loadingIssues} title="Refresh">
                <RefreshCw className={loadingIssues ? "spin" : ""} size={18} />
              </button>
            </header>
            <AdminIssuesView data={issuesData} loading={loadingIssues} adminToken={adminToken} navigate={navigate} filters={issueFilters} onFiltersChange={(filters) => { setIssueFilters(filters); loadIssues(filters); }} />
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
            onImport={handleOverviewImport}
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

function AdminIssuesView({ data, loading, adminToken, navigate = () => {}, filters, onFiltersChange = () => {} }) {
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [error, setError] = useState("");
  const [issueItems, setIssueItems] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    setIssueItems(data?.items || []);
    setSummary(data?.summary || {});
  }, [data]);

  useEffect(() => {
    if (!pendingStatus) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !statusBusy) setPendingStatus(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingStatus, statusBusy]);

  async function openIssue(issue) {
    setDetailLoading(true);
    setError("");
    try {
      setSelectedIssue(await apiRequest(`/admin/issues/${issue.id}`, { adminToken }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateIssueStatus() {
    if (!selectedIssue || !pendingStatus) return;
    setStatusBusy(true);
    setError("");
    try {
      setSelectedIssue(await apiRequest(`/admin/issues/${selectedIssue.id}/status`, {
        method: "PATCH",
        adminToken,
        body: { status: pendingStatus },
      }));
      setIssueItems((items) => items.map((issue) => issue.id === selectedIssue.id ? { ...issue, status: pendingStatus } : issue));
      setSummary((current) => ({
        ...current,
        in_progress: Math.max(0, (current.in_progress ?? 0) + (pendingStatus === "IN_PROGRESS" ? 1 : -1)),
        closed: Math.max(0, (current.closed ?? 0) + (pendingStatus === "CLOSED" ? 1 : -1)),
      }));
      setPendingStatus(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading && !data) return <PanelLoader />;

  return (
    <section className="panel wide">
      <div className="stats-grid admin-stats">
        <Metric icon={<CircleHelp size={20} />} label="Total Issues" value={summary.total ?? 0} />
        <Metric icon={<AlertCircle size={20} />} label="In Progress" value={summary.in_progress ?? 0} />
        <Metric icon={<CheckCircle2 size={20} />} label="Closed Issues" value={summary.closed ?? 0} />
      </div>
      <div className="controls-row" style={{ marginBottom: 16 }}>
        <label className="sort-controls">
          <span>Status</span>
          <select className="sort-select" value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}>
            <option value="">All</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </label>
        <label className="sort-controls">
          <span>Category</span>
          <select className="sort-select" value={filters.category} onChange={(event) => onFiltersChange({ ...filters, category: event.target.value })}>
            <option value="">All</option>
            <option value="BUG">BUG</option>
            <option value="APPLICATION">APPLICATION</option>
            <option value="INTERVIEW">INTERVIEW</option>
            <option value="FEEDBACK">FEEDBACK</option>
            <option value="GENERAL">GENERAL</option>
            <option value="OTHER">OTHER</option>
          </select>
        </label>
        <label className="sort-controls">
          <span>Sort</span>
          <select className="sort-select" value={filters.sort} onChange={(event) => onFiltersChange({ ...filters, sort: event.target.value })}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
      </div>
      {error ? <StatusMessage error={error} /> : null}
      {selectedIssue ? (
        <div className="rsa-warning" style={{ marginBottom: 16, display: "block" }}>
          <button type="button" className="back-button" onClick={() => setSelectedIssue(null)} disabled={detailLoading}>
            <ArrowLeft size={16} /> Back to issues
          </button>
          <h3 style={{ margin: "14px 0 8px" }}>{selectedIssue.title}</h3>
          <dl style={{ display: "grid", gap: 8, margin: "14px 0" }}>
            <div><dt className="muted">Student</dt><dd style={{ margin: 0 }}>
              {selectedIssue.student?.id ? (
                <button type="button" className="link-button" onClick={() => navigate(["admin", "student", selectedIssue.student.id])}>
                  {selectedIssue.student.name || "Student"}
                </button>
              ) : (selectedIssue.student?.name || "Student")}
            </dd></div>
            <div><dt className="muted">Category</dt><dd style={{ margin: 0 }}>{selectedIssue.category}</dd></div>
            <div><dt className="muted">Created</dt><dd style={{ margin: 0 }}>{formatDate(selectedIssue.created_at)}</dd></div>
          </dl>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selectedIssue.description}</p>
          <p className="muted">
            Last updated: {selectedIssue.updated_at ? formatDate(selectedIssue.updated_at) : "Not available"}
            <br />
            Last updated by: {selectedIssue.updated_by?.name || "Not available"}
            {selectedIssue.updated_by?.email ? ` (${selectedIssue.updated_by.email})` : ""}
          </p>
          <label style={{ display: "grid", gap: 6, maxWidth: 280 }}>
            <span className="muted">Status</span>
            <select
              className="sort-select"
              value={selectedIssue.status}
              onChange={(event) => {
                const nextStatus = event.target.value;
                if (nextStatus !== selectedIssue.status) setPendingStatus(nextStatus);
              }}
              disabled={statusBusy}
            >
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
        </div>
      ) : null}
      {!selectedIssue ? (
        data?.items?.length ? (
          <div className="admin-table scrollable" data-scroll-key="issues">
            <div className="admin-head">
              <span>Issue</span>
              <span>Category</span>
              <span>Status</span>
              <span>Student</span>
              <span>Created</span>
            </div>
            {issueItems.map((issue) => (
              <button
                type="button"
                className="admin-row"
                key={issue.id || issue._id}
                onClick={() => openIssue(issue)}
                style={{ width: "100%", textAlign: "left", border: 0, font: "inherit" }}
              >
                <span><strong>{issue.title}</strong></span>
                <span>{issue.category}</span>
                <span className={`status-pill ${issue.status === "IN_PROGRESS" ? "warn" : "good"}`}>{issue.status}</span>
                <span>{issue.student?.name || "Student"}</span>
                <span>{formatDate(issue.created_at)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact"><p>No student issues reported yet.</p></div>
        )
      ) : null}
      {pendingStatus ? (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1100, display: "grid", placeItems: "center", padding: 16, background: "rgba(16, 24, 40, 0.45)" }}>
          <div className="panel" style={{ width: "min(430px, 100%)", margin: 0 }} onClick={(event) => event.stopPropagation()}>
            <div className="panel-title"><CircleHelp size={20} /><h2>Update Issue Status</h2></div>
            <p>Are you sure you want to mark this issue as <strong>{pendingStatus === "CLOSED" ? "CLOSED" : "IN PROGRESS"}</strong>?</p>
            {pendingStatus === "CLOSED" ? <p className="muted">This will mark the issue as CLOSED.</p> : null}
            <div className="rsa-actions">
              <button type="button" className="back-button" onClick={() => setPendingStatus(null)} disabled={statusBusy}>Cancel</button>
              <button type="button" className="primary-button" onClick={updateIssueStatus} disabled={statusBusy}>
                {statusBusy ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />}
                {statusBusy ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
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
        <span className="rep-date">{formatDate(report.interview_date || report.scheduled_at || report.generated_at)}</span>
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

function StudentFeedbackRow({ report, open, onToggle, selected, onSelect, showSelection, onDownload, onCompanyDownload, downloading }) {
  return (
    <div className={`rep-item student-feedback-row ${open ? "open" : ""}`}>
      <div className="rep-row">
        {showSelection ? <label className="student-report-check" onClick={(event) => event.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} aria-label={`Select ${report.student?.name || "student"}`} />
        </label> : null}
        <span className="rep-main">
          <strong>{report.student?.name || "Student"}</strong>
          <span className="rep-sub">{report.company || "Company"} Â· {report.role || "â€”"}</span>
          <span className="rep-sub student-feedback-meta">
            {report.overall?.score != null ? `${report.overall.score}/10 Â· ` : ""}
            {report.visible_to_student ? "Published" : "Pending"}
          </span>
        </span>
        <span className={`vis-badge ${report.visible_to_student ? "on" : ""}`}>{report.visible_to_student ? "Shared" : "Pending"}</span>
        <span className="rep-date">{formatDate(report.interview_date || report.scheduled_at || report.generated_at)}</span>
        <button type="button" className="rep-view-feedback" onClick={onToggle}>
          {open ? "Hide feedback" : "View feedback"}
        </button>
        <button type="button" className="rep-student-download" disabled={downloading} onClick={onDownload}>
          {downloading ? <Loader2 className="spin" size={14} /> : <Download size={14} />} DOCX
        </button>
        <button type="button" className="rep-student-download" disabled={downloading || !report.company_id} onClick={onCompanyDownload}>
          <Building2 size={14} /> Company Feedback
        </button>
      </div>
      {open ? <div className="rep-body"><AdminInterviewReportCard report={report} /></div> : null}
    </div>
  );
}

function FeedbackFormatOption({ value, selected, onChange, title, description }) {
  return (
    <label className={`feedback-format-option ${selected ? "selected" : ""}`}>
      <input type="radio" value={value} checked={selected} onChange={() => onChange(value)} />
      <span className="feedback-format-copy"><strong>{title}</strong><small>{description}</small></span>
    </label>
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
  const [reportSearch, setReportSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all"); // all | YYYY-MM (interview date month)
  const [companyFilter, setCompanyFilter] = useState("all");
  const [feedbackView, setFeedbackView] = useState("company"); // company | student
  const [studentFeedbackMode, setStudentFeedbackMode] = useState("interview"); // interview | student
  const [studentSearch, setStudentSearch] = useState("");
  const [studentCompanyFilter, setStudentCompanyFilter] = useState("all");
  const [studentCompanyCountFilter, setStudentCompanyCountFilter] = useState("all");
  const [openStudentId, setOpenStudentId] = useState(null);
  const [selectedStudentReports, setSelectedStudentReports] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentExporting, setStudentExporting] = useState(null);
  const [companyExporting, setCompanyExporting] = useState(null);
  const [studentDownloadStep, setStudentDownloadStep] = useState("idle");
  const [studentDownloadError, setStudentDownloadError] = useState("");
  const [studentDownloadFormat, setStudentDownloadFormat] = useState("combined");
  const [studentRowDialog, setStudentRowDialog] = useState(null);
  const [studentRowScope, setStudentRowScope] = useState("single");
  const [studentRowFormat, setStudentRowFormat] = useState("combined");
  const [companyDownloadStep, setCompanyDownloadStep] = useState("idle");
  const [companyDownloadError, setCompanyDownloadError] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [companyExportDialog, setCompanyExportDialog] = useState(false);
  const [companyExportScope, setCompanyExportScope] = useState("filtered");
  const [companyExportFormat, setCompanyExportFormat] = useState("combined");
  const [oneCompany, setOneCompany] = useState("");
  const [companyExportValidation, setCompanyExportValidation] = useState("");
  const [showPending, setShowPending] = useState(false); // reveal the pending-extractions list
  const [downloadingCompanyId, setDownloadingCompanyId] = useState(null);

  function formatStudentUuid(value) {
    if (!value) return "";
    const text = String(value);
    if (text.length <= 12) return text;
    return `${text.slice(0, 6)}...${text.slice(-6)}`;
  }

  async function copyStudentUuid(value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
    } catch (error) {
      // Clipboards can fail in some contexts; the full UUID is still exposed in the tooltip.
    }
  }

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

  function sanitizeFilenamePart(text) {
    if (!text) return "Item";
    return text.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "Item";
  }

  function buildStudentFeedbackFilename(studentName, companyNames, scope, mode) {
    const safeName = sanitizeFilenamePart(studentName);
    if (!safeName) return mode === "combined" ? "Student_Feedback_Combined.docx" : "Student_Feedback_Selected.zip";

    if (scope === "single" && companyNames && companyNames.length > 0) {
      const safeCompany = sanitizeFilenamePart(companyNames[0]);
      return `${safeName}_${safeCompany}_Interview_Feedback.docx`;
    }
    if (scope === "selected" && companyNames && companyNames.length > 1) {
      return `${safeName}_Selected_Companies_Interview_Feedback.docx`;
    }
    return mode === "combined" ? `${safeName}_Interview_Feedback.docx` : `${safeName}_Interview_Feedback.zip`;
  }

  async function downloadCompanyFeedback(company) {
    if (!company.companyId || downloadingCompanyId) return;
    setDownloadingCompanyId(company.companyId);
    setError("");
    try {
      const monthQuery = monthFilter === "all" ? "" : `?month=${encodeURIComponent(monthFilter)}`;
      const response = await fetch(`${API_BASE_URL}/admin/reports/company/${company.companyId}/download${monthQuery}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || "Unable to download feedback");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const filename = response.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/i)?.[1]
        || `${company.company.replace(/[^a-z0-9]+/gi, "_")}_Interview_Feedback${monthFilter === "all" ? "" : `_${monthFilter}`}.docx`;
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingCompanyId(null);
    }
  }

  async function exportStudentFeedback(reportIds, mode, scope = "selected", studentName = "", companyNames = [], onDone, studentId = null, studentIds = []) {
    if (!reportIds.length || studentExporting) return;
    const request = { report_ids: reportIds, student_ids: studentIds, mode, scope, student_id: studentId };
    const exportErrorMessage = "Unable to generate the selected feedback. Please try again.";
    let alreadyLogged = false;
    setStudentExporting({ mode, total: reportIds.length });
    setError("");
    setStudentDownloadError("");
    try {
      const response = await fetch(`${API_BASE_URL}/admin/reports/student-feedback/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        alreadyLogged = true;
        console.error("EXPORT ERROR", {
          student_ids: studentIds.length ? studentIds : (studentId ? [studentId] : []),
          format: mode,
          request,
          httpStatus: response.status,
          backendResponse: data,
          error: data?.detail || exportErrorMessage,
        });
        throw new Error(exportErrorMessage);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const downloadName = buildStudentFeedbackFilename(studentName, companyNames, scope, mode);
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onDone?.();
    } catch (err) {
      if (!alreadyLogged) {
        console.error("EXPORT ERROR", {
          student_ids: studentIds.length ? studentIds : (studentId ? [studentId] : []),
          format: mode,
          request,
          httpStatus: err?.status ?? "network",
          backendResponse: null,
          error: err?.message || String(err),
        });
      }
      setError(exportErrorMessage);
      setStudentDownloadError(exportErrorMessage);
    } finally {
      setStudentExporting(null);
    }
  }

  async function exportCompanyFeedback(reportIds, mode, onDone) {
    if (!reportIds.length || companyExporting) return;
    setCompanyExporting(mode);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/admin/reports/company-feedback/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ report_ids: reportIds, mode }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || "Unable to export company feedback");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/i)?.[1]
        || (mode === "combined" ? "Company_Feedback_Combined.docx" : "Company_Feedback_Selected.zip");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCompanyExporting(null);
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

  // UTC keeps the month assignment consistent for every admin near midnight.
  const monthKeyForReport = (report) => {
    const value =
      report.interview_date ||
      report.scheduled_at ||
      report.started_at ||
      report.meeting_date ||
      report.generated_at ||
      report.created_at;
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const companyKeyForReport = (report) => {
    const companyId = report.company_id ?? report.company?.id ?? report.company?._id ?? null;
    if (companyId != null) return String(companyId);
    const companyName = report.company || "Company";
    return `name:${String(companyName)}`;
  };

  const reportMonths = useMemo(() => {
    const byPublishState =
      filter === "pending" ? reports.filter((r) => !r.visible_to_student)
      : filter === "published" ? reports.filter((r) => r.visible_to_student)
      : reports;

    const monthCompanySets = new Map();
    byPublishState.forEach((report) => {
      const key = monthKeyForReport(report);
      if (!key) return;

      const companyKey = companyKeyForReport(report);
      const monthCompanies = monthCompanySets.get(key) || new Set();
      monthCompanies.add(companyKey);
      monthCompanySets.set(key, monthCompanies);
    });

    return [...monthCompanySets.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, companyKeys]) => ({
        key,
        count: companyKeys.size,
        label: new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" })
          .format(new Date(`${key}-01T00:00:00Z`)),
      }));
  }, [filter, reports]);

  const allMonthUniqueCompanyCount = useMemo(() => {
    const byPublishState =
      filter === "pending" ? reports.filter((r) => !r.visible_to_student)
      : filter === "published" ? reports.filter((r) => r.visible_to_student)
      : reports;

    return new Set(byPublishState.map((report) => companyKeyForReport(report))).size;
  }, [filter, reports]);

  const sharedFilteredReports = useMemo(() => {
    const byPublishState =
      filter === "pending" ? reports.filter((r) => !r.visible_to_student)
      : filter === "published" ? reports.filter((r) => r.visible_to_student)
      : reports;
    const byMonth = monthFilter === "all"
      ? byPublishState
      : byPublishState.filter((report) => monthKeyForReport(report) === monthFilter);
    const byCompany = companyFilter === "all" ? byMonth : byMonth.filter((report) => report.company === companyFilter);
    const search = reportSearch.trim().toLowerCase();
    return search ? byCompany.filter((report) => (report.company || "").toLowerCase().includes(search)) : byCompany;
  }, [reports, filter, monthFilter, companyFilter, reportSearch]);

  const studentCompanies = useMemo(() => [...new Set(reports.map((r) => r.company).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)), [reports]);

  const studentReports = useMemo(() => {
    const search = studentSearch.trim().toLowerCase();
    return sharedFilteredReports.filter((report) => {
      const matchesCompany = studentCompanyFilter === "all" || report.company === studentCompanyFilter;
      const searchText = [report.student?.name, report.company, report.role].filter(Boolean).join(" ").toLowerCase();
      return matchesCompany && (!search || searchText.includes(search));
    });
  }, [sharedFilteredReports, studentCompanyFilter, studentSearch]);

  const groupedStudentReports = useMemo(() => {
    const map = new Map();
    studentReports.forEach((report) => {
      const studentId = report.student_id ?? report.student?.id ?? report.student?._id ?? null;
      if (!studentId) return;
      const key = String(studentId);
      if (!map.has(key)) {
        map.set(key, {
          student_id: key,
          student_name: report.student?.name || "Student",
          student_phone: report.student?.phone || report.student?.mobile || "",
          reports: [],
          company_keys: new Set(),
        });
      }
      const group = map.get(key);
      if (!group.student_phone) {
        group.student_phone = report.student?.phone || report.student?.mobile || "";
      }
      group.reports.push(report);
      const companyId = report.company_id ?? report.company?.id ?? report.company?._id ?? report.company ?? null;
      if (companyId != null) group.company_keys.add(String(companyId));
    });
    return [...map.values()].map((group) => ({
      student_id: group.student_id,
      student_name: group.student_name,
      student_phone: group.student_phone || "",
      reports: group.reports,
      company_count: group.company_keys.size,
      interview_count: group.reports.length,
    })).sort((a, b) => a.student_name.localeCompare(b.student_name));
  }, [studentReports]);

  const filteredStudentGroups = useMemo(() => {
    return groupedStudentReports.filter((group) => {
      if (studentCompanyCountFilter === "all") return true;
      if (studentCompanyCountFilter === "4plus") return group.company_count >= 4;
      return group.company_count === Number(studentCompanyCountFilter);
    });
  }, [groupedStudentReports, studentCompanyCountFilter]);

  const selectedVisibleCount = studentFeedbackMode === "student"
    ? filteredStudentGroups.filter((group) => selectedStudentIds.includes(group.student_id)).length
    : studentReports.filter((report) => selectedStudentReports.includes(report.id)).length;
  const allVisibleSelected = studentFeedbackMode === "student"
    ? filteredStudentGroups.length > 0 && selectedVisibleCount === filteredStudentGroups.length
    : studentReports.length > 0 && selectedVisibleCount === studentReports.length;
  function toggleVisibleStudentSelection(checked) {
    if (studentFeedbackMode === "student") {
      const visibleIds = filteredStudentGroups.map((group) => group.student_id);
      setSelectedStudentIds((current) => checked
        ? [...new Set([...current, ...visibleIds])]
        : current.filter((id) => !visibleIds.includes(id)));
      return;
    }
    const visibleIds = studentReports.map((report) => report.id);
    setSelectedStudentReports((current) => checked
      ? [...new Set([...current, ...visibleIds])]
      : current.filter((id) => !visibleIds.includes(id)));
  }
  function exitStudentDownloadMode() {
    setStudentDownloadStep("idle");
    setStudentDownloadError("");
    setSelectedStudentReports([]);
    setSelectedStudentIds([]);
  }
  function openStudentRowDownload(report, preferredScope = "single") {
    const studentId = report?.student_id ?? report?.student?.id ?? report?.student?._id ?? null;
    if (!report || !studentId) return;
    const studentReportsForThisStudent = reports.filter((candidate) => {
      const candidateStudentId = candidate.student_id ?? candidate.student?.id ?? candidate.student?._id ?? null;
      return candidateStudentId != null && String(candidateStudentId) === String(studentId);
    });
    const total = studentReportsForThisStudent.length;
    setStudentRowDialog({
      report,
      studentId,
      studentName: report.student?.name || "Student",
      total,
      reports: studentReportsForThisStudent,
    });
    setStudentRowScope(preferredScope === "student" || total > 1 ? "student" : "single");
    setStudentRowFormat("combined");
  }
  function openStudentGroupDownload(group) {
    if (!group?.reports?.length) return;
    const firstReport = group.reports[0];
    setStudentRowDialog({
      report: firstReport,
      studentId: group.student_id,
      studentName: group.student_name || "Student",
      total: group.reports.length,
      reports: group.reports,
    });
    setStudentRowScope("student");
    setStudentRowFormat("combined");
  }
  function continueStudentDownload() {
    const visibleSelected = studentFeedbackMode === "student"
      ? filteredStudentGroups.filter((group) => selectedStudentIds.includes(group.student_id))
      : studentReports.filter((report) => selectedStudentReports.includes(report.id));
    if (!visibleSelected.length) return setStudentDownloadError("Please select at least one student to continue.");
    setStudentDownloadError("");
    setStudentDownloadStep("format");
  }
  function exitCompanyDownloadMode() {
    setCompanyDownloadStep("idle");
    setCompanyDownloadError("");
    setSelectedCompanies([]);
  }
  function continueCompanyDownload() {
    if (!selectedMatchingCompanyCount) return setCompanyDownloadError("Please select at least one company to continue.");
    setCompanyDownloadError("");
    setCompanyDownloadStep("format");
  }

  // Reports grouped by company, filtered by month and publish state.
  const companies = useMemo(() => {
    const map = {};
    sharedFilteredReports.forEach((r) => {
      const key = r.company || "Company";
      if (!map[key]) map[key] = { company: key, companyId: r.company_id, expectations: null, focus: [], reports: [] };
      map[key].reports.push(r);
      if (!map[key].expectations && r.company_expectations?.expectations) {
        map[key].expectations = r.company_expectations.expectations;
        map[key].focus = r.company_expectations.focus || [];
      }
    });
    return Object.values(map).sort((a, b) => b.reports.length - a.reports.length);
  }, [sharedFilteredReports]);

  const matchingCompanyNames = companies.map((company) => company.company);
  const selectedMatchingCompanyCount = matchingCompanyNames.filter((name) => selectedCompanies.includes(name)).length;
  const allMatchingCompaniesSelected = matchingCompanyNames.length > 0 && selectedMatchingCompanyCount === matchingCompanyNames.length;
  function toggleMatchingCompanies(checked) {
    setSelectedCompanies((current) => checked
      ? [...new Set([...current, ...matchingCompanyNames])]
      : current.filter((name) => !matchingCompanyNames.includes(name)));
  }
  function openCompanyExportDialog() {
    setCompanyExportValidation("");
    setCompanyExportScope("filtered");
    setCompanyExportFormat("combined");
    setOneCompany(matchingCompanyNames[0] || studentCompanies[0] || "");
    setCompanyExportDialog(true);
  }
  function submitCompanyExport() {
    let sourceReports = [];
    if (companyExportScope === "one") {
      if (!oneCompany) return setCompanyExportValidation("Choose one company to download.");
      sourceReports = reports.filter((report) => report.company === oneCompany);
    } else if (companyExportScope === "selected") {
      if (!selectedCompanies.length) return setCompanyExportValidation("Select at least one company first.");
      sourceReports = reports.filter((report) => selectedCompanies.includes(report.company));
    } else if (companyExportScope === "filtered") {
      sourceReports = sharedFilteredReports;
    } else {
      sourceReports = reports;
    }
    if (!sourceReports.length) return setCompanyExportValidation("No interview feedback matches this download scope.");
    setCompanyExportValidation("");
    setCompanyExportDialog(false);
    exportCompanyFeedback(sourceReports.map((report) => report.id), companyExportFormat);
  }

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

      {!loading && reports.length ? (
        <div className="rep-view-tabs" role="tablist" aria-label="Interview feedback view">
          <button type="button" role="tab" aria-selected={feedbackView === "company"} className={`rep-view-tab ${feedbackView === "company" ? "on" : ""}`} onClick={() => setFeedbackView("company")}>Company Feedback</button>
          <button type="button" role="tab" aria-selected={feedbackView === "student"} className={`rep-view-tab ${feedbackView === "student" ? "on" : ""}`} onClick={() => setFeedbackView("student")}>Student Feedback</button>
        </div>
      ) : null}

      {/* Half-finished / not-yet-run transcript extractions: resume each on its own. */}
      {/* {pending.length ? (
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
      ) : null} */}

      {!loading && reports.length ? (
        <div className="rep-filters">
          <label className="student-search rep-toolbar-search">
            <span>Search company</span>
            <input
              value={reportSearch}
              onChange={(event) => { setReportSearch(event.target.value); setOpenCompany(null); setOpenStudentId(null); }}
              placeholder="Search company..."
              aria-label="Search interview reports by company"
            />
          </label>
          <div className="rep-toolbar-status" aria-label="Report status filter">
            <span className="rep-filter-label">Status</span>
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
          {feedbackView === "student" ? (
            <>
              <div className="rep-view-tabs student-subview-tabs" role="tablist" aria-label="Student feedback subview">
                <button type="button" role="tab" aria-selected={studentFeedbackMode === "interview"} className={`rep-view-tab ${studentFeedbackMode === "interview" ? "on" : ""}`} onClick={() => setStudentFeedbackMode("interview")}>Interview View</button>
                <button type="button" role="tab" aria-selected={studentFeedbackMode === "student"} className={`rep-view-tab ${studentFeedbackMode === "student" ? "on" : ""}`} onClick={() => setStudentFeedbackMode("student")}>Student View</button>
              </div>
              <label className="student-search rep-toolbar-search">
                <span>Search</span>
                <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search student, company, or role..." />
              </label>
            </>
          ) : null}
          <div className="rep-toolbar-controls">
            <label className="student-company-select">
              <span>Month</span>
              <select value={monthFilter} onChange={(event) => { setMonthFilter(event.target.value); setOpenCompany(null); }}>
                <option value="all">All months ({allMonthUniqueCompanyCount})</option>
                {reportMonths.map((month) => <option key={month.key} value={month.key}>{month.label} ({month.count})</option>)}
              </select>
            </label>
            {feedbackView === "student" ? (
              <>
                <label className="student-company-select">
                  <span>Company</span>
                  <select value={studentCompanyFilter} onChange={(event) => { setStudentCompanyFilter(event.target.value); setOpenStudentId(null); }}>
                    <option value="all">All companies</option>
                    {studentCompanies.map((company) => <option key={company} value={company}>{company}</option>)}
                  </select>
                </label>
                {studentFeedbackMode === "student" ? (
                  <label className="student-company-select">
                    <span>Companies attended</span>
                    <select value={studentCompanyCountFilter} onChange={(event) => setStudentCompanyCountFilter(event.target.value)}>
                      <option value="all">All</option>
                      <option value="1">1 company</option>
                      <option value="2">2 companies</option>
                      <option value="3">3 companies</option>
                      <option value="4plus">4+ companies</option>
                    </select>
                  </label>
                ) : null}
              </>
            ) : (
              <label className="student-company-select">
                <span>Company</span>
                <select value={companyFilter} onChange={(event) => { setCompanyFilter(event.target.value); setOpenCompany(null); }}>
                  <option value="all">All companies</option>
                  {studentCompanies.map((company) => <option key={company} value={company}>{company}</option>)}
                </select>
              </label>
            )}
            {feedbackView === "student" && studentDownloadStep === "idle" ? <button type="button" className="company-download-trigger" onClick={() => setStudentDownloadStep("select")}>Download feedback</button> : null}
            {feedbackView === "company" && companyDownloadStep === "idle" ? <button type="button" className="company-download-trigger" onClick={() => setCompanyDownloadStep("select")}>Download feedback</button> : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <PanelLoader />
      ) : feedbackView === "student" ? (
        <section className="student-feedback-view">
          <div className="student-feedback-heading">
            <p className="eyebrow">All Student Feedback</p>
            <h2>
              {studentFeedbackMode === "student"
                ? `${filteredStudentGroups.length} unique student${filteredStudentGroups.length === 1 ? "" : "s"}`
                : `${studentReports.length} ${studentReports.length === 1 ? "interview report" : "interview reports"}`}
            </h2>
            {studentReports.length !== reports.length ? <p className="ov-sub">Filtered from {reports.length} available reports</p> : null}
          </div>
          {!studentReports.length ? (
            <div className="empty-state compact"><p>{reportSearch.trim() ? "No interview reports found." : "No student feedback matches these filters."}</p></div>
          ) : (
            <>
              <div className="student-export-actions">
                {studentDownloadStep === "select" ? <><strong>Select student feedback to download</strong><button type="button" onClick={exitStudentDownloadMode}>Cancel</button><button type="button" className="company-download-trigger" onClick={continueStudentDownload}>Continue</button></> : null}
                {studentDownloadError ? <span className="company-export-error">{studentDownloadError}</span> : null}
                <label className="student-select-all" style={{ display: studentDownloadStep === "select" ? undefined : "none" }}><input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleVisibleStudentSelection(event.target.checked)} /> Select all matching {studentFeedbackMode === "student" ? "students" : "students"}</label>
                <span style={{ display: studentDownloadStep === "select" ? undefined : "none" }}>{selectedVisibleCount} student{selectedVisibleCount === 1 ? "" : "s"} selected</span>
                <details className="student-export-menu" style={{ display: "none" }}>
                  <summary>{studentExporting ? "Preparing export…" : "Download all student feedback"}</summary>
                  <div>
                    <button type="button" disabled={!!studentExporting} onClick={() => {
                      const allReports = studentReports;
                      const studentName = allReports[0]?.student?.name || "Student";
                      const companyNames = [...new Set(allReports.map((report) => report.company || "Company").filter(Boolean))];
                      exportStudentFeedback(allReports.map((report) => report.id), "combined", "student", studentName, companyNames);
                    }}>Combined DOCX</button>
                    <button type="button" disabled={!!studentExporting} onClick={() => {
                      const allReports = studentReports;
                      const studentName = allReports[0]?.student?.name || "Student";
                      const companyNames = [...new Set(allReports.map((report) => report.company || "Company").filter(Boolean))];
                      exportStudentFeedback(allReports.map((report) => report.id), "separate", "student", studentName, companyNames);
                    }}>Separate DOCX files</button>
                    <button type="button" disabled={!!studentExporting} onClick={() => {
                      const allReports = studentReports;
                      const studentName = allReports[0]?.student?.name || "Student";
                      const companyNames = [...new Set(allReports.map((report) => report.company || "Company").filter(Boolean))];
                      exportStudentFeedback(allReports.map((report) => report.id), "both", "student", studentName, companyNames);
                    }}>Combined + Separate</button>
                  </div>
                </details>
                {(studentFeedbackMode === "interview" ? selectedStudentReports : filteredStudentGroups.filter((group) => selectedStudentIds.includes(group.student_id))).length ? (
                  <details className="student-export-menu" style={{ display: "none" }}>
                    <summary>{studentExporting ? `Generating ${studentExporting.total} document${studentExporting.total === 1 ? "" : "s"}…` : "Download selected"}</summary>
                    <div>
                      <button type="button" disabled={!!studentExporting} onClick={() => {
                        const selectedGroups = studentFeedbackMode === "student"
                          ? filteredStudentGroups.filter((group) => selectedStudentIds.includes(group.student_id))
                          : [];
                        const selectedReportIds = studentFeedbackMode === "student"
                          ? selectedGroups.flatMap((group) => group.reports.map((report) => report.id))
                          : selectedStudentReports;
                        const selectedReports = studentReports.filter((report) => selectedReportIds.includes(report.id));
                        const studentName = selectedReports[0]?.student?.name || "Student";
                        const companyNames = [...new Set(selectedReports.map((report) => report.company || "Company").filter(Boolean))];
                        exportStudentFeedback(selectedReportIds, "combined", "selected", studentName, companyNames, undefined, null, selectedGroups.map((group) => group.student_id));
                      }}>Combined DOCX</button>
                      <button type="button" disabled={!!studentExporting} onClick={() => {
                        const selectedGroups = studentFeedbackMode === "student"
                          ? filteredStudentGroups.filter((group) => selectedStudentIds.includes(group.student_id))
                          : [];
                        const selectedReportIds = studentFeedbackMode === "student"
                          ? selectedGroups.flatMap((group) => group.reports.map((report) => report.id))
                          : selectedStudentReports;
                        const selectedReports = studentReports.filter((report) => selectedReportIds.includes(report.id));
                        const studentName = selectedReports[0]?.student?.name || "Student";
                        const companyNames = [...new Set(selectedReports.map((report) => report.company || "Company").filter(Boolean))];
                        exportStudentFeedback(selectedReportIds, "separate", "selected", studentName, companyNames, undefined, null, selectedGroups.map((group) => group.student_id));
                      }}>Separate DOCX files</button>
                      <button type="button" disabled={!!studentExporting} onClick={() => {
                        const selectedGroups = studentFeedbackMode === "student"
                          ? filteredStudentGroups.filter((group) => selectedStudentIds.includes(group.student_id))
                          : [];
                        const selectedReportIds = studentFeedbackMode === "student"
                          ? selectedGroups.flatMap((group) => group.reports.map((report) => report.id))
                          : selectedStudentReports;
                        const selectedReports = studentReports.filter((report) => selectedReportIds.includes(report.id));
                        const studentName = selectedReports[0]?.student?.name || "Student";
                        const companyNames = [...new Set(selectedReports.map((report) => report.company || "Company").filter(Boolean))];
                        exportStudentFeedback(selectedReportIds, "both", "selected", studentName, companyNames, undefined, null, selectedGroups.map((group) => group.student_id));
                      }}>Combined + Separate</button>
                    </div>
                  </details>
                ) : null}
              </div>
              <div className="rep-list" data-scroll-key="student-reports">
                {studentFeedbackMode === "student" ? (
                  filteredStudentGroups.map((group) => {
                    const expanded = openStudentId === group.student_id;
                    const selected = selectedStudentIds.includes(group.student_id);
                    return (
                      <div key={group.student_id} className={`rep-item student-feedback-row ${expanded ? "open" : ""}`}>
                        <div className="rep-row">
                          {studentDownloadStep === "select" ? <label className="student-report-check" onClick={(event) => event.stopPropagation()}>
                            <input type="checkbox" checked={selected} onChange={(event) => setSelectedStudentIds((current) => event.target.checked ? [...new Set([...current, group.student_id])] : current.filter((id) => id !== group.student_id))} aria-label={`Select ${group.student_name}`} />
                          </label> : null}
                          <span className="rep-main">
                            <strong>{group.student_name || "Student"}</strong>
                            <span className="rep-sub">
                              {group.company_count} {group.company_count === 1 ? "company" : "companies"} · {group.interview_count} {group.interview_count === 1 ? "interview" : "interviews"}
                              {group.student_phone ? ` · 📱 ${group.student_phone}` : ""}
                              {group.student_id ? ` · ID: ` : ""}
                              {group.student_id ? (
                                <button
                                  type="button"
                                  className="rep-uuid-link"
                                  title={group.student_id}
                                  onClick={(event) => { event.stopPropagation(); void copyStudentUuid(group.student_id); }}
                                >
                                  {formatStudentUuid(group.student_id)}
                                </button>
                              ) : null}
                            </span>
                          </span>
                          {group.interview_count > 1 ? (
                            <button type="button" className="rep-view-feedback" onClick={() => setOpenStudentId(expanded ? null : group.student_id)}>
                              {expanded ? "Collapse" : "Expand"}
                            </button>
                          ) : null}
                          <button type="button" className="rep-view-feedback" onClick={() => setOpenStudentId(expanded ? null : group.student_id)}>
                            {expanded ? "Hide" : "View"}
                          </button>
                          <button type="button" className="rep-student-download" disabled={!!studentExporting} onClick={() => openStudentGroupDownload(group)}>
                            {studentExporting ? <Loader2 className="spin" size={14} /> : <Download size={14} />} DOCX
                          </button>
                        </div>
                        {expanded ? (
                          <div className="rep-body">
                            {group.reports.map((report) => (
                              <div key={report.id} className="rep-item student-feedback-row nested-student-row">
                                <div className="rep-row">
                                  <span className="rep-main">
                                    <strong>{report.company || "Company"}</strong>
                                    <span className="rep-sub">{report.role || "—"}{report.overall?.score != null ? ` · ${report.overall.score}/10` : ""}{report.visible_to_student ? " · Published" : " · Pending"}</span>
                                  </span>
                                  <button type="button" className="rep-view-feedback" onClick={() => setOpenStudentId(group.student_id)}>
                                    View
                                  </button>
                                  <button type="button" className="rep-student-download" disabled={!!studentExporting} onClick={() => openStudentRowDownload(report)}>
                                    {studentExporting ? <Loader2 className="spin" size={14} /> : <Download size={14} />} DOCX
                                  </button>
                                  <button type="button" className="rep-student-download" disabled={!!studentExporting || !report.company_id} onClick={() => downloadCompanyFeedback({ companyId: report.company_id, company: report.company })}>
                                    <Building2 size={14} /> Company Feedback
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  studentReports.map((report) => (
                    <StudentFeedbackRow
                      key={report.id}
                      report={report}
                      selected={selectedStudentReports.includes(report.id)}
                      showSelection={studentDownloadStep === "select"}
                      open={openStudentId === report.id}
                      onSelect={(checked) => setSelectedStudentReports((current) => checked ? [...new Set([...current, report.id])] : current.filter((id) => id !== report.id))}
                      onToggle={() => setOpenStudentId(openStudentId === report.id ? null : report.id)}
                      downloading={!!studentExporting}
                      onDownload={() => openStudentRowDownload(report)}
                      onCompanyDownload={() => downloadCompanyFeedback({ companyId: report.company_id, company: report.company })}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </section>
      ) : !companies.length ? (
        <div className="empty-state compact">
          <p>
            {filter === "pending" ? "No pending reports — everything is published."
              : filter === "published" ? "No published reports yet."
              : monthFilter !== "all" ? "No interview reports for this month."
              : reportSearch.trim() ? "No interview reports found." : "No interview reports yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="company-export-toolbar">
            {companyDownloadStep === "select" ? <><strong>Select company feedback to download</strong><label className="student-select-all"><input type="checkbox" checked={allMatchingCompaniesSelected} onChange={(event) => toggleMatchingCompanies(event.target.checked)} /> Select all matching companies</label><span>{selectedMatchingCompanyCount} compan{selectedMatchingCompanyCount === 1 ? "y" : "ies"} selected</span><button type="button" onClick={exitCompanyDownloadMode}>Cancel</button><button type="button" className="company-download-trigger" onClick={continueCompanyDownload}>Continue</button></> : null}
            {companyDownloadError ? <span className="company-export-error">{companyDownloadError}</span> : null}
          </div>
          <div className="rep-list" data-scroll-key="reports">
            {companies.map((c) => (
            <div className={`rep-item ${openCompany === c.company ? "open" : ""}`} key={c.company}>
              <div className="rep-row" onClick={() => setOpenCompany(openCompany === c.company ? null : c.company)}>
                {companyDownloadStep === "select" ? <label className="student-report-check" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={selectedCompanies.includes(c.company)} onChange={(event) => setSelectedCompanies((current) => event.target.checked ? [...new Set([...current, c.company])] : current.filter((name) => name !== c.company))} aria-label={`Select ${c.company}`} />
                </label> : null}
                <span className="rep-caret">{openCompany === c.company ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                <span className="rep-main">
                  <strong>{c.company}</strong>
                  <span className="rep-sub">{c.reports.length} candidate{c.reports.length === 1 ? "" : "s"}{c.expectations ? " · RSA ready" : ""}</span>
                </span>
                {false && c.companyId ? (
                  <button
                    type="button"
                    className="rep-download"
                    disabled={downloadingCompanyId === c.companyId}
                    onClick={(event) => { event.stopPropagation(); downloadCompanyFeedback(c); }}
                  >
                    {downloadingCompanyId === c.companyId ? <><Loader2 className="spin" size={14} /> Preparing…</> : <><Download size={14} /> {monthFilter === "all" ? "Download all feedback" : "Download month feedback"}</>}
                  </button>
                ) : null}
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
        </>
      )}
      {studentDownloadStep === "format" || studentDownloadStep === "confirm" ? (
        <div className="company-export-backdrop" role="presentation">
          <section className="company-export-dialog" role="dialog" aria-modal="true">
            {studentDownloadStep === "format" ? <><h2>Download Student Feedback</h2><p>{selectedVisibleCount} student{selectedVisibleCount === 1 ? "" : "s"} selected</p><h3>Download format</h3><div className="feedback-format-options"><FeedbackFormatOption value="combined" selected={studentDownloadFormat === "combined"} onChange={setStudentDownloadFormat} title="Combined DOCX" description="One document containing all selected students" /><FeedbackFormatOption value="separate" selected={studentDownloadFormat === "separate"} onChange={setStudentDownloadFormat} title="Separate DOCX files" description="One document for each selected student" /><FeedbackFormatOption value="both" selected={studentDownloadFormat === "both"} onChange={setStudentDownloadFormat} title="Combined + Separate" description="One combined document + individual student documents" /></div><div className="company-dialog-actions"><button type="button" onClick={() => setStudentDownloadStep("select")}>Back</button><button type="button" className="company-download-trigger" onClick={() => setStudentDownloadStep("confirm")}>Continue</button></div></> : <><h2>Confirm Download</h2><p>You are about to download {selectedVisibleCount} student{selectedVisibleCount === 1 ? "" : "s"}.</p><p><strong>Format:</strong> {studentDownloadFormat === "combined" ? "Combined DOCX" : studentDownloadFormat === "separate" ? "Separate DOCX files" : "Combined + Separate"}</p><div className="company-dialog-actions"><button type="button" onClick={exitStudentDownloadMode} disabled={!!studentExporting}>Cancel</button><button type="button" className="company-download-trigger" disabled={!!studentExporting} onClick={() => {
              const selectedGroups = filteredStudentGroups.filter((group) => selectedStudentIds.includes(group.student_id));
              const selectedReportIds = selectedGroups.flatMap((group) => group.reports.map((report) => report.id));
              const selectedReports = studentReports.filter((report) => selectedReportIds.includes(report.id));
              const studentName = selectedReports[0]?.student?.name || "Student";
              const companyNames = [...new Set(selectedReports.map((report) => report.company || "Company").filter(Boolean))];
              exportStudentFeedback(selectedReportIds, studentDownloadFormat, "selected", studentName, companyNames, exitStudentDownloadMode, null, selectedGroups.map((group) => group.student_id));
            }}>Confirm &amp; Download</button></div></>}
          </section>
        </div>
      ) : null}
      {studentRowDialog ? (
        <div className="company-export-backdrop" role="presentation" onMouseDown={() => !studentExporting && setStudentRowDialog(null)}>
          <section className="company-export-dialog" role="dialog" aria-modal="true" aria-labelledby="student-row-export-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="student-row-export-title">Download Student Feedback</h2>
            <p><strong>Student:</strong> {studentRowDialog.studentName}</p>
            {studentRowDialog.total > 1 ? (
              <>
                <p>This student has {studentRowDialog.total} interview reports.</p>
                <h3>What would you like to download?</h3>
                <label><input type="radio" name="student-row-scope" checked={studentRowScope === "single"} onChange={() => setStudentRowScope("single")} /> This interview only</label>
                {studentRowDialog.report.company ? <p className="ov-muted">{studentRowDialog.report.company}</p> : null}
                <label><input type="radio" name="student-row-scope" checked={studentRowScope === "student"} onChange={() => setStudentRowScope("student")} /> Include all interviews for this student</label>
                <p className="ov-muted">{studentRowDialog.total} interviews across {new Set(studentRowDialog.reports.map((report) => report.company || "Company")).size} companies</p>
              </>
            ) : (
              <p>This student has 1 interview report.</p>
            )}
            <h3>Format</h3>
            {studentRowScope === "single" ? (
              <label><input type="radio" checked readOnly /> DOCX</label>
            ) : (
              <>
                <label><input type="radio" name="student-row-format" checked={studentRowFormat === "combined"} onChange={() => setStudentRowFormat("combined")} /> Combined DOCX</label>
                <label><input type="radio" name="student-row-format" checked={studentRowFormat === "separate"} onChange={() => setStudentRowFormat("separate")} /> Separate DOCX files</label>
                <label><input type="radio" name="student-row-format" checked={studentRowFormat === "both"} onChange={() => setStudentRowFormat("both")} /> Combined + Separate</label>
              </>
            )}
            <div className="company-dialog-actions">
              <button type="button" onClick={() => setStudentRowDialog(null)}>Cancel</button>
              <button type="button" className="company-download-trigger" onClick={() => {
                const scopeForExport = studentRowScope === "student" ? "student" : "single";
                const reportIds = scopeForExport === "student" ? studentRowDialog.reports.map((report) => report.id) : [studentRowDialog.report.id];
                const mode = scopeForExport === "single" ? "combined" : studentRowFormat;
                const studentName = studentRowDialog.studentName || "Student";
                const companyNames = scopeForExport === "student"
                  ? [...new Set(studentRowDialog.reports.map((report) => report.company || "Company").filter(Boolean))]
                  : [studentRowDialog.report.company || "Company"];
                exportStudentFeedback(
                  reportIds,
                  mode,
                  scopeForExport,
                  studentName,
                  companyNames,
                  () => setStudentRowDialog(null),
                  studentRowDialog.studentId,
                );
              }}>Confirm &amp; Download</button>
            </div>
          </section>
        </div>
      ) : null}
      {companyDownloadStep === "format" || companyDownloadStep === "confirm" ? (
        <div className="company-export-backdrop" role="presentation">
          <section className="company-export-dialog" role="dialog" aria-modal="true">
            {companyDownloadStep === "format" ? <><h2>Download Company Feedback</h2><p>{selectedMatchingCompanyCount} compan{selectedMatchingCompanyCount === 1 ? "y" : "ies"} selected</p><h3>Download format</h3><div className="feedback-format-options"><FeedbackFormatOption value="combined" selected={companyExportFormat === "combined"} onChange={setCompanyExportFormat} title="Combined DOCX" description="One document containing all selected companies" /><FeedbackFormatOption value="separate" selected={companyExportFormat === "separate"} onChange={setCompanyExportFormat} title="Separate DOCX files" description="One document for each selected company" /><FeedbackFormatOption value="both" selected={companyExportFormat === "both"} onChange={setCompanyExportFormat} title="Combined + Separate" description="One combined document + individual company documents" /></div><div className="company-dialog-actions"><button type="button" onClick={() => setCompanyDownloadStep("select")}>Back</button><button type="button" className="company-download-trigger" onClick={() => setCompanyDownloadStep("confirm")}>Continue</button></div></> : <><h2>Confirm Download</h2><p>You are about to download {selectedMatchingCompanyCount} compan{selectedMatchingCompanyCount === 1 ? "y" : "ies"}.</p><p><strong>Format:</strong> {companyExportFormat === "combined" ? "Combined DOCX" : companyExportFormat === "separate" ? "Separate DOCX files" : "Combined + Separate"}</p><div className="company-dialog-actions"><button type="button" onClick={exitCompanyDownloadMode}>Cancel</button><button type="button" className="company-download-trigger" onClick={() => exportCompanyFeedback(reports.filter((report) => selectedCompanies.includes(report.company)).map((report) => report.id), companyExportFormat, exitCompanyDownloadMode)}>Confirm &amp; Download</button></div></>}
          </section>
        </div>
      ) : null}
      {companyExportDialog ? (
        <div className="company-export-backdrop" role="presentation" onMouseDown={() => !companyExporting && setCompanyExportDialog(false)}>
          <section className="company-export-dialog" role="dialog" aria-modal="true" aria-labelledby="company-export-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="company-export-title">Download Company Feedback</h2>
            <h3>Download scope</h3>
            <label><input type="radio" name="company-scope" checked={companyExportScope === "one"} onChange={() => setCompanyExportScope("one")} /> One company</label>
            {companyExportScope === "one" ? <label className="company-dialog-select">Company<select value={oneCompany} onChange={(event) => setOneCompany(event.target.value)}><option value="">Select company</option>{studentCompanies.map((company) => <option key={company} value={company}>{company}</option>)}</select></label> : null}
            <label><input type="radio" name="company-scope" checked={companyExportScope === "selected"} onChange={() => setCompanyExportScope("selected")} /> Selected companies ({selectedCompanies.length})</label>
            <label><input type="radio" name="company-scope" checked={companyExportScope === "filtered"} onChange={() => setCompanyExportScope("filtered")} /> Current filtered companies ({companies.length})</label>
            <label><input type="radio" name="company-scope" checked={companyExportScope === "all"} onChange={() => setCompanyExportScope("all")} /> All companies</label>
            <h3>Format</h3>
            <label><input type="radio" name="company-format" checked={companyExportFormat === "combined"} onChange={() => setCompanyExportFormat("combined")} /> Combined DOCX</label>
            <label><input type="radio" name="company-format" checked={companyExportFormat === "separate"} onChange={() => setCompanyExportFormat("separate")} /> Separate DOCX files</label>
            <label><input type="radio" name="company-format" checked={companyExportFormat === "both"} onChange={() => setCompanyExportFormat("both")} /> Combined + Separate</label>
            {companyExportValidation ? <p className="company-export-error">{companyExportValidation}</p> : null}
            <div className="company-dialog-actions"><button type="button" onClick={() => setCompanyExportDialog(false)}>Cancel</button><button type="button" className="company-download-trigger" onClick={submitCompanyExport}>Download</button></div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function AdminOverview({
  loading, summary, funnel, loss, actionCenter, placement, reportsSummary,
  recentOpportunities, searchTerm, setSearchTerm, sortBy, setSortBy,
  onImport, adminToken, onRefresh, openCompany, navigate,
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
            {placement.rate ?? 0}% placed · {placement.placed ?? 0} of {placement.total_students ?? 0} students · {fmt(summary.total_applications)} applications across {fmt(summary.total_opportunities)} openings
          </p>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title="Refresh">
          <RefreshCw className={loading ? "spin" : ""} size={18} />
        </button>
      </header>

      <AddCompaniesPanel adminToken={adminToken} onImported={onImport} />

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
        {/* <section className="ov-card">
          <h2>Where we lose people</h2>
          <p className="ov-muted">Slices of the {fmt(applied)} applications. Neither is a rejection, and they can overlap.</p>
          <div className="ov-loss">
            <LossItem label="Dropped — student declined" n={loss.dropped} applied={applied} color="#94a3b8" note="The student turned the opening down — role fit, location or timing. Worth asking why before mapping them again." />
            <LossItem label="Awaiting company response" n={loss.awaiting} applied={applied} color="#f59e0b" note="Still at Applied with no decision recorded. Stalled, not lost — this is the pile the action queue chases." />
            <LossItem label="Not shortlisted — resume screen" n={loss.not_shortlisted} applied={applied} color="#b42318" note="A resume-stage pass with the company's note attached where they gave one — never a failed interview." />
          </div>
        </section> */}

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
                  <div className="ov-thead"><span>Company</span><span>Role</span><span>Applied</span><span>Shortlisted</span><span>Received</span><span>Status</span></div>
                  {recentOpportunities.map((o) => (
                    <div className="ov-trow" key={o.id}>
                      <div className="ov-cell">
                        <button type="button" className="link-button" onClick={() => openCompany(o.company)} title="View company detail">
                          {o.company?.name || "Company"}
                          {isNoStudentEligibleStatus(o.student_side_status) ? (
                            <span className="ov-no-student-star" aria-label="No Student Eligible">*</span>
                          ) : null}
                        </button>
                        <span>{o.location || "—"}</span>
                      </div>
                      <div className="ov-cell">
                        <strong>{o.role || "Role not mapped"}</strong>
                        <span>{o.tech_stack || o.must_have_skills || "—"}</span>
                      </div>
                      <span className="ov-applied">{o.application_count ?? 0}</span>
                      <ShortlistCell applied={o.application_count ?? 0} shortlisted={Number(o.shortlists_count) || 0} />
                      <span className="ov-date">{formatDate(o.opportunity_received_at)}</span>
                      <SheetAvailabilityStatus
                        studentResponseSheet={o.student_response_sheet}
                        companySheet={o.company_sheet}
                      />
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

function SheetAvailabilityStatus({ studentResponseSheet, companySheet }) {
  const hasResponse = Boolean(String(studentResponseSheet || "").trim());
  const hasShortlist = Boolean(String(companySheet || "").trim());
  const status = hasResponse && hasShortlist
    ? { className: "available", label: "Sheets available" }
    : hasResponse
      ? { className: "response-only", label: "Response sheet only" }
      : hasShortlist
        ? { className: "shortlist-only", label: "Shortlist sheet only" }
        : { className: "none", label: "No sheets" };

  return (
    <div className={`ov-sheet-availability ${status.className}`}>
      <span className="ov-sheet-dot" aria-hidden="true" />
      <span>{status.label}</span>
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
  const [updatingPlacement, setUpdatingPlacement] = useState(false);
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);
  const [updateError, setUpdateError] = useState("");

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

  async function updatePlacement(placedStatus) {
    setUpdatingPlacement(true);
    setUpdateError("");
    try {
      const student = await apiRequest(`/admin/students/${studentId}/placement`, {
        method: "PATCH", adminToken, body: { placed_status: placedStatus },
      });
      setData((current) => current ? { ...current, student: { ...current.student, placed_status: student.placed_status } } : current);
    } catch (e) {
      setUpdateError(e.message);
    } finally {
      setUpdatingPlacement(false);
    }
  }

  async function updateApplicationStatus(applicationId, newStatus) {
    if (!applicationId) return;
    setUpdatingApplicationId(applicationId);
    setUpdateError("");
    try {
      const result = await apiRequest(`/applications/${applicationId}/status`, {
        method: "POST", adminToken, body: { new_status: newStatus },
      });
      const status = result.application?.current_status || newStatus;
      setData((current) => current ? {
        ...current,
        applications: current.applications.map((application) => application.id === applicationId ? { ...application, status } : application),
      } : current);
    } catch (e) {
      setUpdateError(e.message);
    } finally {
      setUpdatingApplicationId(null);
    }
  }

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
        <button type="button" className="primary-button" onClick={() => navigate(["admin", "student", studentId])}>
          <UsersRound size={17} /> View as student
        </button>
      </header>

      {error || updateError ? <StatusMessage error={error || updateError} /> : null}

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
              <button
                type="button"
                className={s.placed_status ? "status-chip placement-toggle placed" : "status-chip placement-toggle"}
                onClick={() => updatePlacement(!s.placed_status)}
                disabled={updatingPlacement}
              >
                {updatingPlacement ? "Saving…" : s.placed_status ? "Placed — mark unplaced" : "Mark as placed"}
              </button>
            </div>
          </section>

          <section className="kpi-grid">
            <KpiTile label="Applied" value={fmt(stats.interested)} />
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
                      <div className="application-status-control">
                        <StatusChip status={a.status} />
                        <select
                          aria-label={`Update status for ${a.company}`}
                          value={a.status || "APPLIED"}
                          disabled={updatingApplicationId === a.id || !a.id}
                          onChange={(event) => updateApplicationStatus(a.id, event.target.value)}
                        >
                          {APPLICATION_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                        </select>
                      </div>
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
          {/* Company-wide totals, and only while no single opening is open: with
              one opening they are that opening's numbers repeated, and with
              several the opening below shows its own. */}
          {!selectedOppId ? (
            <section className="stats-grid admin-stats">
              <Metric icon={<BriefcaseBusiness size={20} />} label="Opportunities" value={data.opportunity_count ?? 0} />
              <Metric icon={<UsersRound size={20} />} label="Applied" value={stats.applied_count ?? 0} />
              <Metric icon={<BadgeCheck size={20} />} label="Shortlisted" value={stats.shortlisted_count ?? 0} />
            </section>
          ) : null}

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
  manualPreview: (adminToken, sessionId, body) =>
    apiRequest(`/interview-sessions/${sessionId}/manual-analysis/preview`, { method: "POST", adminToken, body }),
  manualSave: (adminToken, sessionId, body) =>
    apiRequest(`/interview-sessions/${sessionId}/manual-analysis`, { method: "POST", adminToken, body }),
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
  autoSyncResponse: (adminToken, opportunityId) =>
    apiRequest(`/admin/opportunities/${opportunityId}/sync/responses/auto`, {
      method: "POST",
      adminToken,
    }),
  incremental: (adminToken, url) =>
    apiRequest("/admin/sync/incremental", {
      method: "POST",
      adminToken,
      body: { url },
    }),
  fullSync: (adminToken, url) =>
    apiRequest("/admin/sync/full", {
      method: "POST",
      adminToken,
      body: { url },
    }),
  pasteSync: (adminToken, rawText, url) =>
    apiRequest("/admin/sync/paste", {
      method: "POST",
      adminToken,
      body: { raw_text: rawText, url: url || null },
    }),
  deleteOpportunity: (adminToken, opportunityId, reason) =>
    apiRequest(`/admin/opportunities/${opportunityId}`, {
      method: "DELETE",
      adminToken,
      body: { reason },
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

// One cell of a master-row change, as the preview shows it. An empty cell reads
// as "(empty)" so "filled in" and "changed" look different at a glance.
function formatCellValue(value) {
  if (value === null || value === undefined || value === "") return "(empty)";
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function AddCompaniesPanel({ adminToken, onImported }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [url, setUrl] = useState(() => localStorage.getItem(MASTER_URL_KEY) || "");
  const [fromUrl, setFromUrl] = useState(false); // whether the current preview came from a URL fetch
  const [preview, setPreview] = useState(null);
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncMode, setSyncMode] = useState("full");
  const [confirmMode, setConfirmMode] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [warning, setWarning] = useState("");

  function reset() {
    setPreview(null);
    setApplied(null);
    setError("");
    setWarning("");
  }

  // Every sync - Pull only new, Fetch entire sheet, pasted rows - runs the same
  // pipeline: Master rows first, then each opening's responses and shortlist.
  // An error here means the Master stage failed and nothing was synced.
  async function runSync(request, onDone) {
    setBusy(true);
    setSyncing(true);
    setError("");
    setWarning("");
    try {
      const result = await request();
      setApplied({ result });
      setPreview(null);
      onDone?.();
      if (result.status === "PARTIAL") {
        setWarning(result.message || "Some openings could not be synced - see the sync results below.");
      }
      await onImported?.(result);
    } catch (err) {
      setError(err.message || "Sync failed.");
    } finally {
      setBusy(false);
      setSyncing(false);
    }
  }

  // Pasted Master rows. The header row is optional: copied rows get the header
  // of the Master sheet link above. Confirming runs the full pipeline.
  async function run(confirm) {
    if (confirm) {
      await runSync(() => sheetApi.pasteSync(adminToken, text, url.trim()), () => setText(""));
      return;
    }
    setBusy(true);
    setError("");
    setFromUrl(false);
    try {
      const result = await apiRequest("/admin/companies/import", {
        method: "POST",
        adminToken,
        body: { raw_text: text, confirm: false, url: url.trim() || null },
      });
      if (confirm) {
        setApplied(result);
        setPreview(null);
        setText("");
        await onImported?.(result);
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

  // Preview the whole Master sheet; confirming runs the full pipeline.
  async function runUrl(confirm) {
    localStorage.setItem(MASTER_URL_KEY, url.trim());
    if (confirm) {
      await runSync(() => sheetApi.fullSync(adminToken, url.trim()));
      return;
    }
    setBusy(true);
    setError("");
    setFromUrl(true);
    try {
      const result = await sheetApi.masterFetch(adminToken, url.trim(), confirm);
      localStorage.setItem(MASTER_URL_KEY, url.trim());
      if (confirm) {
        setApplied(result);
        setPreview(null);
        await onImported?.(result);
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

  async function runIncremental() {
    setBusy(true);
    setError("");
    try {
      const result = await sheetApi.incremental(adminToken, url.trim());
      setApplied({ incremental: true, result });
      await onImported?.(result);
    } catch (err) {
      const resultData = err.data;
      if (resultData?.opportunity_results) {
        setApplied({ incremental: true, result: resultData });
        await onImported?.(resultData);
      }
      setError(`Incremental sync completed with failures. ${err.message || "Please check the sync details."}`);
    } finally {
      setBusy(false);
    }
  }

  function requestSync() {
    if (!url.trim() || busy) return;
    setConfirmMode(syncMode);
  }

  async function confirmSync() {
    const mode = confirmMode;
    setConfirmMode(null);
    if (mode === "incremental") {
      await runIncremental();
    } else {
      await runUrl(false);
    }
  }

  const counts = preview?.counts || {};
  const incrementalResults = applied?.result?.opportunity_results || [];
  // Openings where something was imported or went wrong. The rest (already
  // imported, no link, empty sheet) are only counted, so a full sync stays readable.
  const activeResults = incrementalResults.filter(
    (item) => item.response?.status !== "SKIPPED" || item.shortlist?.status !== "SKIPPED",
  );
  const quietCount = incrementalResults.length - activeResults.length;
  const responseSynced = incrementalResults.filter((item) => item.response?.status === "SUCCESS").length;
  const responseSkipped = incrementalResults.filter((item) => item.response?.status === "SKIPPED").length;
  const responseFailed = incrementalResults.filter((item) => item.response?.status === "FAILED").length;
  const shortlistSynced = incrementalResults.filter((item) => item.shortlist?.status === "SUCCESS").length;
  const shortlistSkipped = incrementalResults.filter((item) => item.shortlist?.status === "SKIPPED").length;
  const shortlistFailed = incrementalResults.filter((item) => item.shortlist?.status === "FAILED").length;

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
            row creates a company and its opening, or updates them if they already exist — and an
            opening you deleted comes back if the sheet still lists it. Responses and shortlists are
            loaded for every opening in the same run; nothing needs Force by hand.
          </p>

          {!preview && !applied ? (
            <div className="rsa-master-url">
              <input
                className="search-input"
                placeholder="Master sheet link (https://docs.google.com/spreadsheets/...)"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
          ) : null}

          <div className="rsa-global-sync">
            <div>
              <h3>Sync</h3>
              <p className="rsa-hint">Fetch the complete Master Sheet or pull only newly added data across all opportunities.</p>
            </div>
            <div className="rsa-global-sync-controls">
              <select aria-label="Sync Mode" value={syncMode} onChange={(event) => setSyncMode(event.target.value)} disabled={busy}>
                <option value="full">Fetch entire sheet data</option>
                <option value="incremental">Pull only newly added data</option>
              </select>
              <button className="rsa-sync-btn" type="button" onClick={requestSync} disabled={!url.trim() || busy}>
                {busy ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                {busy ? "Syncing..." : "Pull & Sync"}
              </button>
            </div>
          </div>

          {syncing ? (
            <div className="sync-progress" aria-live="polite">
              <strong>Sync Progress</strong>
              <span>● Master Sheet processing</span>
              <span>● Loading responses for new and changed openings</span>
              <span>● Shortlists load after their responses</span>
            </div>
          ) : null}

          {confirmMode ? (
            <div className="sync-confirm-backdrop" role="presentation">
              <section className="sync-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="sync-confirm-title">
                <h2 id="sync-confirm-title">
                  {confirmMode === "full" ? "Fetch Entire Sheet" : "Pull Newly Added Data"}
                </h2>
                <p>
                  {confirmMode === "full"
                    ? "This will fetch and compare the complete Master Sheet. This may take longer than an incremental sync. Continue?"
                    : "This will check for newly added opportunities and sync their available response and shortlist data. Continue?"}
                </p>
                <div className="sync-confirm-actions">
                  <button type="button" className="back-button" onClick={() => setConfirmMode(null)}>Cancel</button>
                  <button type="button" className="primary-button" onClick={confirmSync}>Confirm &amp; Pull</button>
                </div>
              </section>
            </div>
          ) : null}

          {error ? <StatusMessage error={error} /> : null}

          {warning ? (
            <div className="rsa-warning" style={{ marginBottom: 12 }}>
              <TriangleAlert size={16} />
              <span>{warning}</span>
            </div>
          ) : null}

          {applied ? (
            <div className="status success" style={{ marginBottom: 12 }}>
              <BadgeCheck size={18} />
              <span>
                {`Sync completed. Opportunities added: ${applied.result?.master?.created ?? 0}. Restored: ${applied.result?.master?.restored ?? 0}. Updated: ${applied.result?.master?.updated ?? 0}. Unchanged: ${applied.result?.master?.unchanged ?? 0}. Response synced: ${responseSynced}, skipped: ${responseSkipped}, failed: ${responseFailed}. Shortlist synced: ${shortlistSynced}, skipped: ${shortlistSkipped}, failed: ${shortlistFailed}.`}
              </span>
            </div>
          ) : null}

          {activeResults.length ? (
            <div className="sync-results">
              <h3>Sync Results</h3>
              {quietCount ? (
                <p className="muted">{quietCount} other opening(s) had nothing new to import.</p>
              ) : null}
              {activeResults.map((item) => (
                <div className={`sync-result ${item.response?.status === "FAILED" || item.shortlist?.status === "FAILED" ? "attention" : ""}`} key={item.opportunity_id}>
                  <strong>
                    {item.is_new ? "New opening" : item.restored ? "Restored opening" : "Existing opening"}:{" "}
                    {item.company ? `${item.company}${item.role ? ` · ${item.role}` : ""}` : item.opportunity_id}
                  </strong>
                  {item.restored ? (
                    <span className="success-text">✓ Deleted earlier — restored, because the Master sheet still lists it</span>
                  ) : null}
                  <span className={item.response?.status === "SUCCESS" ? "success-text" : "attention-text"}>
                    {item.response?.status === "SUCCESS" ? "✓ Response imported" : item.response?.status === "SKIPPED" ? `⚠ ${item.response.reason}` : `✗ Response import failed: ${item.response?.error || "unknown error"}`}
                  </span>
                  <span className={item.shortlist?.status === "SUCCESS" ? "success-text" : item.shortlist?.status === "SKIPPED" ? "muted" : "attention-text"}>
                    {item.shortlist?.status === "SUCCESS" ? "✓ Shortlist imported" : item.shortlist?.status === "SKIPPED" ? `⊘ Shortlist skipped: ${item.shortlist.reason}` : `✗ Shortlist import failed: ${item.shortlist?.error || "unknown error"}`}
                  </span>
                </div>
              ))}
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
                {counts.opportunities_to_restore ? (
                  <div><span>To restore</span><strong>{counts.opportunities_to_restore}</strong></div>
                ) : null}
                <div><span>Unchanged</span><strong>{counts.opportunities_unchanged ?? 0}</strong></div>
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
                      <strong>Sheet links changed — confirming re-pulls these sheets automatically:</strong>
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

              {(() => {
                // What this sync will actually change. Rows that match the
                // database exactly are counted above but not listed here.
                const touched = (preview.rows || []).filter((r) => r.action !== "unchanged");
                const unchangedCount = (preview.rows || []).length - touched.length;
                return (
                  <>
                    {unchangedCount ? (
                      <p className="muted" style={{ marginBottom: 8 }}>
                        {unchangedCount} row(s) match the database exactly and are not listed — their
                        responses and shortlists are still synced.
                      </p>
                    ) : null}
                    <div className="rsa-preview-table">
                      {touched.map((row) => (
                        <div className="rsa-preview-row" key={row.row}>
                          <span className="muted">{row.row}</span>
                          <div>
                            <strong>{row.company || "(no company)"}</strong>
                            <span>{row.role}{row.received_on ? ` · ${row.received_on}` : ""}</span>
                            {row.changes?.length ? (
                              <ul className="rsa-change-list">
                                {row.changes.map((change) => (
                                  <li key={change.field}>
                                    {change.field.replaceAll("_", " ")}:{" "}
                                    <span className="rsa-change-old">{formatCellValue(change.old)}</span>
                                    {" → "}
                                    <span className="rsa-change-new">{formatCellValue(change.new)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <span className={`status-pill ${row.action === "skip" ? "bad" : row.action.includes("create") ? "neutral" : "good"}`}>
                            {row.action.replaceAll("_", " ").replace("opportunity", "opening")}
                          </span>
                          <span className="muted">{row.company_new ? "new company" : row.reason || ""}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

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

function isNoStudentEligibleStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "no student eligible" || normalized === "no student eligble";
}

/* --- Paste a response / shortlist sheet for this opening ----------- */
function SheetImportPanel({ adminToken, opportunityId, opportunity, onImported }) {
  const [kind, setKind] = useState("responses");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fetchingResponse, setFetchingResponse] = useState(false);
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
      setLinkMsg("Saved. Now use “Fetch Data” to pull the updated response sheet.");
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

  async function fetchResponseSheet() {
    setBusy(true);
    setFetchingResponse(true);
    reset();
    try {
      const result = await sheetApi.autoSyncResponse(adminToken, opportunityId);
      setApplied(result);
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setFetchingResponse(false);
      setBusy(false);
    }
  }

  async function fetchAndSyncSheets() {
    if (busy) return;
    const hasResponseSheet = Boolean((opportunity?.student_response_sheet || "").trim());
    const hasShortlistSheet = Boolean((opportunity?.company_sheet || "").trim());
    if (!hasResponseSheet) {
      setError("Response sheet URL missing. Add it via Sheet links or use the paste workflow.");
      return;
    }

    setBusy(true);
    setFetchingResponse(true);
    reset();
    try {
      const result = hasShortlistSheet
        ? await sheetApi.autoSyncResponse(adminToken, opportunityId)
        : await sheetApi.sync(adminToken, opportunityId, "responses", true, true);
      setApplied({ ...result, synced: true, responseOnly: !hasShortlistSheet });
      await onImported?.(result);
    } catch (err) {
      setError(err.message || "Could not fetch the sheets.");
    } finally {
      setFetchingResponse(false);
      setBusy(false);
    }
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
            <button
              type="button"
              className="rsa-sync-btn"
              onClick={fetchAndSyncSheets}
              disabled={busy || !(opportunity?.student_response_sheet || "").trim()}
              title={
                !(opportunity?.student_response_sheet || "").trim()
                  ? "Response sheet URL missing"
                  : "Fetch response sheet, then shortlist sheet"
              }
            >
              {busy ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
              {busy ? "Fetching..." : (opportunity?.company_sheet || "").trim() ? "Fetch & Sync Sheets" : "Fetch Response Sheet"}
            </button>
            <button type="button" className="rsa-link-btn" onClick={toggleLinks} disabled={busy}>
              <Link2 size={15} />
              Sheet links
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

      {!((opportunity?.student_response_sheet || "").trim()) ? (
        <div className="rsa-warning" style={{ marginBottom: 12 }}>
          <TriangleAlert size={16} />
          <span>
            Response sheet URL missing. Automatic response import is unavailable.
            {((opportunity?.company_sheet || "").trim()) ? " Automatic shortlist sync is unavailable until the response stage succeeds." : ""}
          </span>
        </div>
      ) : null}
      {((opportunity?.student_response_sheet || "").trim()) && !((opportunity?.company_sheet || "").trim()) ? (
        <div className="rsa-warning" style={{ marginBottom: 12 }}>
          <TriangleAlert size={16} />
          <span>Shortlist sheet URL missing. Response fetching remains available; shortlist import requires the response stage first.</span>
        </div>
      ) : null}

      {fetchingResponse ? (
        <div className="status" style={{ marginBottom: 12 }}>
          <Loader2 className="spin" size={18} />
          <span>Fetching response sheet...</span>
        </div>
      ) : null}

      {applied ? (
        <div className="status success" style={{ marginBottom: 12 }}>
          <BadgeCheck size={18} />
          <span>
            {applied.mode === "skipped"
              ? applied.message
              : applied.synced
                ? "Synced from Google Sheets."
                : kind === "responses"
                  ? `Response sheet imported successfully. Students created: ${applied.counts.students_to_create ?? 0}. Students updated: ${applied.counts.students_matched ?? 0}. Applications created: ${applied.counts.applications_to_create ?? 0}. Applications updated: ${applied.counts.applications_to_update ?? 0}. Skipped rows: ${applied.counts.skipped ?? 0}.`
                  : `Imported ${applied.counts.rows} row(s): ${applied.counts.applications_to_mark} marked shortlisted${applied.counts.status_preserved ? ` · ${applied.counts.status_preserved} kept their existing status` : ""}`}
          </span>
        </div>
      ) : null}

      {applied?.shortlist_counts ? (
        <div className="status success" style={{ marginBottom: 12 }}>
          <BadgeCheck size={18} />
          <span>
            Shortlist imported successfully. Applications shortlisted: {applied.shortlist_counts.shortlisted ?? applied.shortlist_counts.applications_to_mark ?? 0}. Skipped rows: {((applied.shortlist_counts.ambiguous ?? 0) + (applied.shortlist_counts.unmatched ?? 0))}.
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
  const [manualText, setManualText] = useState("");
  const [manualPayload, setManualPayload] = useState(null);
  const [manualPreview, setManualPreview] = useState(null);

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
      setStage("choose");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runAutomatedAnalysis() {
    if (!sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await rsaApi.analyze(adminToken, sessionId);
      setAnalysis(result);
      await loadReports(sessionId);
      await refreshSide();
      setStage("done");
      setTab("reports");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startManualAnalysis() {
    setError("");
    setManualText("");
    setManualPayload(null);
    setManualPreview(null);
    setStage("manual");
  }

  function parseManualPayload() {
    try {
      const parsed = JSON.parse(manualText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Top-level JSON must be an object.");
      return parsed;
    } catch (err) {
      setError(`Invalid manual analysis JSON: ${err.message}`);
      return null;
    }
  }

  async function previewManual() {
    const payload = parseManualPayload();
    if (!payload || !sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      setManualPayload(payload);
      setManualPreview(await rsaApi.manualPreview(adminToken, sessionId, payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveManual() {
    if (!manualPayload || !sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await rsaApi.manualSave(adminToken, sessionId, manualPayload);
      setAnalysis({
        ...result,
        manual: true,
        candidates_analyzed: result.candidate_reports_saved,
        questions_extracted: result.questions_saved,
      });
      await loadReports(sessionId);
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

      {stage === "choose" ? (
        <div className="rsa-analysis-choice">
          <h3 className="detail-subhead">How do you want to analyze this interview?</h3>
          <p className="rsa-hint">The transcript and confirmed participants are saved. Choose how to create the questions and feedback.</p>
          <div className="rsa-analysis-choice-actions">
            <button type="button" className="back-button" onClick={startManualAnalysis} disabled={busy}>
              <Pencil size={16} /> Manual Analysis
            </button>
            <button type="button" className="primary-button" onClick={runAutomatedAnalysis} disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              Automated AI
            </button>
          </div>
        </div>
      ) : null}

      {stage === "manual" ? (
        <div className="rsa-manual-analysis">
          <h3 className="detail-subhead">Manual Interview Analysis</h3>
          <p className="rsa-hint">Paste the structured JSON prepared from this confirmed transcript. Nothing is saved until you confirm the preview.</p>
          <div className="rsa-manual-participants">
            <strong>Interview participants</strong>
            {(proposal?.shortlisted_students || []).filter((student) => (proposal?.speaker_map || []).some((entry) => entry.role === "student" && String(entry.student_id) === String(student.student_id))).map((student) => (
              <span key={student.student_id}><CheckCircle2 size={15} /> {student.name || "Student"}</span>
            ))}
          </div>
          {!manualPreview ? (
            <>
              <textarea className="rsa-textarea rsa-manual-textarea" value={manualText} onChange={(event) => setManualText(event.target.value)} spellCheck={false} placeholder={'{"candidates": [], "questions": [], "company_expectations": {}}'} />
              <div className="rsa-actions">
                <button type="button" className="back-button" onClick={() => setStage("choose")} disabled={busy}>Back</button>
                <button type="button" className="primary-button" onClick={previewManual} disabled={busy || !manualText.trim()}>
                  {busy ? <Loader2 className="spin" size={18} /> : <Eye size={18} />} Validate &amp; Preview
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rsa-manual-preview">
                <strong>Manual Analysis Preview</strong>
                <span>Candidates: {manualPreview.candidates}</span>
                <span>Questions: {manualPreview.questions}</span>
                {manualPreview.anonymous_questions ? <span>Questions saved as anonymous: {manualPreview.anonymous_questions}</span> : null}
                <span>Company feedback: {manualPreview.company_expectations ? "Yes" : "No"}</span>
                {manualPreview.categories?.map((category, index) => (
                  <span key={`${category.input}-${index}`}>Category: {category.input} → {category.normalized} ({category.status})</span>
                ))}
                {manualPreview.question_types?.map((type, index) => (
                  <span key={`${type.input}-${index}`}>Question type: {type.input} → {type.normalized} ({type.status})</span>
                ))}
                {manualPreview.candidate_preview?.map((candidate) => (
                  <span key={candidate.name}>{candidate.name}: {candidate.mapping_status} · Application {candidate.application} · Report {candidate.report} · {candidate.questions} question(s)</span>
                ))}
              </div>
              <div className="rsa-actions">
                <button type="button" className="back-button" onClick={() => setManualPreview(null)} disabled={busy}>Back</button>
                <button type="button" className="primary-button" onClick={saveManual} disabled={busy}>
                  {busy ? <Loader2 className="spin" size={18} /> : <BadgeCheck size={18} />} Save analysis
                </button>
              </div>
            </>
          )}
        </div>
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
                {analysis.message ? ` — ${analysis.message}` : ""}
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
  const [confirmBulkReject, setConfirmBulkReject] = useState(false);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkRejectError, setBulkRejectError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const remainingInterviewed = useMemo(() => {
    return applicants.filter((applicant) => {
      const s = String(applicant.status || applicant.current_status || "").toUpperCase();
      const finalS = String(applicant.final_status || "").toUpperCase();
      const isInterviewCompleted = ["INTERVIEW_COMPLETED", "INTERVIEW_DONE"].includes(s);
      const hasFinalResult =
        ["HIRED", "SELECTED", "REJECTED", "DROPPED"].includes(finalS) ||
        ["SELECTED", "JOINED", "REJECTED", "DROPPED"].includes(s);
      return isInterviewCompleted && !hasFinalResult;
    });
  }, [applicants]);

  const handleBulkReject = async () => {
    setBulkRejecting(true);
    setBulkRejectError("");
    try {
      await apiRequest(`/admin/opportunities/${opportunityId}/mark-not-selected`, {
        method: "POST",
        adminToken,
      });
      setConfirmBulkReject(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      setBulkRejectError(err.message || "Failed to mark candidates as Not Selected");
    } finally {
      setBulkRejecting(false);
    }
  };

  const handleDeleteOpportunity = async () => {
    const reason = deleteReason.trim();
    if (!reason) {
      setDeleteError("A deletion reason is required.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this opportunity?")) return;

    setDeleteBusy(true);
    setDeleteError("");
    try {
      await sheetApi.deleteOpportunity(adminToken, opportunityId, reason);
      window.location.hash = `#/admin/company/${o.company_id || detail.company?.id || ""}`;
    } catch (err) {
      setDeleteError(err.message || "Failed to delete opportunity.");
      setDeleteBusy(false);
    }
  };

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
    ["Shortlists (CRM)", o.master_shortlists_count ?? o.shortlists_count],
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
        {/* Every card counts this opening's own applications, so they always add
            up against the applicant list below. Applied is the only intake
            number shown: "Responses" counted the same rows, minus nobody except
            the students who said they were not interested. */}
        <Metric icon={<UsersRound size={20} />} label="Applied" value={stats.applied_count ?? o.application_count ?? 0} />
        <Metric icon={<BadgeCheck size={20} />} label="Shortlisted" value={stats.shortlisted_count ?? 0} />
        <Metric
          icon={<XCircle size={20} />}
          label="Not shortlisted"
          value={(stats.not_shortlisted_count ?? 0) + (stats.rejected_count ?? 0)}
        />
      </section>

      <section className="content-grid admin-grid">
        <div className="panel wide">
          <div className="panel-title">
            <FileText size={20} />
            <h2>{o.role || "Opportunity"}</h2>
            {o.company_status ? (
              <span className={`status-pill ${companyStatusClass(o.company_status)}`}>{o.company_status}</span>
            ) : null}
            <button
              type="button"
              className="back-button"
              onClick={() => { setDeleteOpen(true); setDeleteError(""); }}
              disabled={deleteBusy}
              style={{ marginLeft: "auto", color: "#b42318", borderColor: "#f3b5b0" }}
            >
              Delete Opportunity
            </button>
          </div>

          {deleteOpen ? (
            <div className="rsa-warning" style={{ marginBottom: 14, display: "block" }}>
              <strong>Delete Opportunity</strong>
              <p style={{ margin: "8px 0" }}>Provide a reason before continuing. The opportunity and related records will be archived, not removed.</p>
              <textarea
                className="rsa-textarea"
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="Reason for deletion"
                disabled={deleteBusy}
                rows={3}
              />
              {deleteError ? <StatusMessage error={deleteError} /> : null}
              <div className="rsa-actions">
                <button type="button" className="back-button" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
                  Cancel
                </button>
                <button type="button" className="primary-button" onClick={handleDeleteOpportunity} disabled={deleteBusy || !deleteReason.trim()}>
                  {deleteBusy ? "Archiving..." : "Continue"}
                </button>
              </div>
            </div>
          ) : null}

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
                {remainingInterviewed.length > 0 && adminToken && (
                  <button
                    type="button"
                    onClick={() => { setConfirmBulkReject(true); setBulkRejectError(""); }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#be123c",
                      backgroundColor: "#fff1f2",
                      border: "1px solid #fecdd3",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    <XCircle size={15} />
                    Mark remaining interviewed candidates as Not Selected ({remainingInterviewed.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {confirmBulkReject && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                display: "grid",
                placeItems: "center",
                zIndex: 1000,
                padding: 16,
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  padding: 24,
                  maxWidth: 450,
                  width: "100%",
                  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: 18, color: "#1e293b" }}>Confirm Final Status Update</h3>
                <p style={{ margin: "0 0 20px", fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
                  Mark {remainingInterviewed.length} remaining interviewed candidate{remainingInterviewed.length === 1 ? "" : "s"} as Not Selected?
                </p>
                {bulkRejectError && (
                  <div style={{ color: "#e11d48", fontSize: 13, marginBottom: 16 }}>{bulkRejectError}</div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setConfirmBulkReject(false); setBulkRejectError(""); }}
                    disabled={bulkRejecting}
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkReject}
                    disabled={bulkRejecting}
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "none",
                      background: "#e11d48",
                      color: "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    {bulkRejecting ? "Updating..." : "Confirm"}
                  </button>
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
                  <ApplicantRow
                    key={applicant.id || applicant._id}
                    application={applicant}
                    adminToken={adminToken}
                    onUpdated={onRefresh}
                  />
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

function ApplicantRow({ application, adminToken, onUpdated }) {
  const student = application.student || {};
  const [editing, setEditing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(
    application.status || application.current_status || "APPLIED"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentStatus = String(application.status || application.current_status || "").toUpperCase();

  const links = [
    ["Resume", application.resume_link],
    ["Project", application.project_link],
    ["GitHub", application.github_link],
  ].filter(([, href]) => Boolean(href));

  const handleSaveStatus = async () => {
    if (!selectedStatus || selectedStatus === currentStatus) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const appId = application.id || application._id;
      await apiRequest(`/applications/${appId}/status`, {
        method: "POST",
        body: {
          new_status: selectedStatus,
          reason: "Manual status update by admin",
          source: "manual",
        },
        adminToken,
      });
      setEditing(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-row applicants-row">
      <div>
        <strong>{student.name || "Student"}</strong>
        <span>{student.phone || student.email || "Contact not added"}</span>
      </div>
      <div>
        {editing ? (
          <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={saving}
                style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff" }}
              >
                <option value="SHORTLISTED">SHORTLISTED</option>
                <option value="INTERVIEW_COMPLETED">INTERVIEW COMPLETED</option>
                <option value="SELECTED">SELECTED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="NOT_SHORTLISTED">NOT SHORTLISTED</option>
                <option value="APPLIED">APPLIED</option>
              </select>
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={saving}
                title="Save status"
                style={{
                  background: "#0f766e",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {saving ? "..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(""); }}
                disabled={saving}
                title="Cancel"
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
            </div>
            {error && <span style={{ color: "#e11d48", fontSize: 11 }}>{error}</span>}
          </div>
        ) : (
          <span className={`status-pill ${statusClass(application.status)}`}>{formatStatus(application.status)}</span>
        )}
      </div>
      <div>
        <span>{formatDate(application.applied_at)}</span>
      </div>
      <div className="link-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {links.length ? (
          links.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" title={label} className="icon-link">
              {getLinkIcon(label)}
            </a>
          ))
        ) : (
          <span className="muted">No links</span>
        )}
        {adminToken && !editing && (
          <button
            type="button"
            className="icon-link"
            onClick={() => {
              setSelectedStatus(currentStatus || "SHORTLISTED");
              setEditing(true);
            }}
            title="Edit Status"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "inline-flex",
              alignItems: "center",
              color: "#64748b",
            }}
          >
            <Pencil size={15} />
          </button>
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
  const [placementFilter, setPlacementFilter] = useState("all");

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

  // Filter students by search and placement outcome.
  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (student.name || "").toLowerCase().includes(searchLower) ||
      (student.phone || "").includes(searchTerm) ||
      (student.email || "").toLowerCase().includes(searchLower)
    );
    const matchesPlacement = placementFilter === "all"
      || (placementFilter === "placed" ? student.placed_status : !student.placed_status);
    return matchesSearch && matchesPlacement;
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
            <div className="sort-controls">
              <label>Placement:</label>
              <select value={placementFilter} onChange={(e) => setPlacementFilter(e.target.value)} className="sort-select">
                <option value="all">All students</option>
                <option value="placed">Placed</option>
                <option value="not_placed">Not placed</option>
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
        <div className="empty-state compact"><p>{searchTerm || placementFilter !== "all" ? "No students match your filters." : "No students found."}</p></div>
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

