import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
  XCircle,
  Code,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Lightbulb,
  MessageSquareQuote,
  Mic,
  Send,
  Sparkles,
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
    throw new Error(data?.detail || "Something went wrong");
  }

  return data;
}

function App() {
  const [route, navigate] = useHashRoute();
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

  if (loadingStudent) {
    return <LoadingScreen />;
  }

  if (mode === "admin") {
    if (!adminToken) {
      return <AdminAccess onAuthenticated={handleAdminAuthenticated} onStudentMode={() => switchMode("student")} />;
    }
    return (
      <AdminDashboard
        adminToken={adminToken}
        onLogout={handleAdminLogout}
        route={route}
        navigate={navigate}
      />
    );
  }

  if (!token || !student) {
    return (
      <AuthScreen
        authView={authView}
        setAuthView={setAuthView}
        onAuthenticated={handleAuthenticated}
        onAdminMode={() => switchMode("admin")}
      />
    );
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

function AuthScreen({ authView, setAuthView, onAuthenticated, onAdminMode }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { identifier, password },
      });

      if (data.status === "password_reset_required") {
        setResetToken(data.reset_token);
        setAuthView("reset");
        setMessage("Create a new password to continue.");
        return;
      }

      onAuthenticated(data.access_token);
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

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("/auth/set-password", {
        method: "POST",
        body: { reset_token: resetToken, new_password: newPassword },
      });

      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { identifier, password: newPassword },
      });

      if (data.access_token) {
        onAuthenticated(data.access_token);
      } else {
        setAuthView("login");
        setMessage("Password updated. Please login again.");
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
            <h1>Student Growth Portal</h1>
            <p>Interview feedback, company applications, and project readiness in one place.</p>
          </div>
        </div>
        <button className="mode-switch" type="button" onClick={onAdminMode}>
          <BarChart3 size={17} />
          Admin dashboard
        </button>

        {authView === "login" ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>Phone or email</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Registered mobile number"
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
                  placeholder="Temporary or new password"
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
              Login
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSetPassword}>
            <div className="reset-header">
              <KeyRound size={22} />
              <div>
                <h2>Create New Password</h2>
                <p>This is required after first login or admin password reset.</p>
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
              Save Password
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function AdminAccess({ onAuthenticated, onStudentMode }) {
  const [email, setEmail] = useState("admin@2931");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/auth/admin-login", {
        method: "POST",
        body: { email, password },
      });
      onAuthenticated(data.access_token);
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
            <h1>Admin Dashboard</h1>
            <p>Track students, company opportunities, applications, and shortlists.</p>
          </div>
        </div>
        <button className="mode-switch" type="button" onClick={onStudentMode}>
          <UserRound size={17} />
          Student login
        </button>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@2931"
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
                placeholder="Admin password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <StatusMessage error={error} />
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
            Open Dashboard
          </button>
        </form>
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
  const overall = report.overall || {};
  const skills = Object.entries(report.skill_ratings || {});

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

          <h4><CircleHelp size={15} /> Every question you were asked</h4>
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
                {answer.student_answer ? <p><em>You said:</em> {answer.student_answer}</p> : null}
                {answer.feedback ? <p><em>Feedback:</em> {answer.feedback}</p> : null}
                {answer.ideal_answer ? (
                  <p className="rsa-ideal"><em>A better answer:</em> {answer.ideal_answer}</p>
                ) : null}
              </div>
            ))}
          </div>
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

function PracticeBank({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeScenario, setIncludeScenario] = useState(false);
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (includeScenario) params.set("include_scenario", "true");
    if (category) params.set("category", category);
    if (difficulty) params.set("difficulty", difficulty);
    if (search.trim()) params.set("search", search.trim());
    apiRequest(`/students/me/practice-questions?${params.toString()}`, { token })
      .then((result) => live && setData(result))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [token, includeScenario, category, difficulty, search]);

  const questions = data?.questions || [];

  // Company Focus: the topics these questions actually cover, so it can never
  // disagree with the list shown underneath it.
  const focus = useMemo(() => {
    const seen = [];
    questions.forEach((question) => {
      [question.category, question.topic].forEach((value) => {
        const label = (value || "").trim();
        if (label && !seen.includes(label)) seen.push(label);
      });
    });
    return seen.slice(0, 10);
  }, [questions]);

  return (
    <>
      <p className="rsa-hint">
        Real questions asked in interviews across companies. Use them to prepare — the more often a
        question shows up, the more likely you'll be asked it.
      </p>

      <div className="rsa-filters">
        <input
          className="search-input"
          placeholder="Search questions…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="sort-select" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All topics</option>
          {(data?.categories || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select className="sort-select" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <label className="rsa-toggle">
          <input
            type="checkbox"
            checked={includeScenario}
            onChange={(event) => setIncludeScenario(event.target.checked)}
          />
          <span>
            Include scenario-based
            {data?.scenario_available ? ` (${data.scenario_available})` : ""}
          </span>
        </label>
      </div>

      {error ? <StatusMessage error={error} /> : null}
      {loading ? <PanelLoader /> : null}

      {!loading && !questions.length ? (
        <div className="empty-state compact">
          <p>
            {search || category || difficulty
              ? "No questions match these filters."
              : "No practice questions yet. They appear here as interviews get analysed."}
          </p>
        </div>
      ) : null}

      {!loading && questions.length ? (
        <>
          {focus.length ? (
            <div className="rsa-focus">
              <strong>What these companies focus on</strong>
              <div className="rsa-focus-list">
                {focus.map((item) => (
                  <span className="rsa-focus-chip" key={item}>{item}</span>
                ))}
              </div>
            </div>
          ) : null}

          <p className="muted" style={{ marginBottom: 10 }}>
            Showing {questions.length} question{questions.length === 1 ? "" : "s"}
            {!includeScenario && data?.scenario_available
              ? ` · ${data.scenario_available} scenario question${data.scenario_available === 1 ? "" : "s"} hidden`
              : ""}
          </p>

          {/* Grouped by topic so a student revises one area at a time. */}
          {(data?.groups || []).map((group) => (
            <div className="rsa-group" key={group.category}>
              <div className="rsa-group-head">
                <span className="rsa-cat tech">{group.category}</span>
                <span className="muted">{group.count} question{group.count === 1 ? "" : "s"}</span>
              </div>
              <div className="rsa-practices">
                {group.questions.map((question) => (
                  <PracticeQuestionCard key={question.question_key} question={question} />
                ))}
              </div>
            </div>
          ))}
        </>
      ) : null}
    </>
  );
}

function StudentReportsView({ reports, loading, focusId, token }) {
  const [tab, setTab] = useState("feedback");

  return (
    <section className="panel wide">
      <div className="panel-title">
        <FileText size={20} />
        <h2>Interview Feedback</h2>
      </div>

      <div className="rsa-tabs">
        <button type="button" className={tab === "feedback" ? "active" : ""} onClick={() => setTab("feedback")}>
          My feedback ({reports.length})
        </button>
        <button type="button" className={tab === "practice" ? "active" : ""} onClick={() => setTab("practice")}>
          Practice questions
        </button>
      </div>

      {tab === "feedback" ? (
        loading ? (
          <PanelLoader />
        ) : reports.length ? (
          <>
            <p className="rsa-hint">
              Detailed feedback from your interviews, including what to improve before the next one.
            </p>
            <div className="rsa-reports">
              {reports.map((report) => (
                <StudentReportCard key={report.id} report={report} defaultOpen={report.id === focusId} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>
              No feedback published yet. After an interview, your feedback appears here once the
              placement team has reviewed it.
            </p>
          </div>
        )
      ) : (
        <PracticeBank token={token} />
      )}
    </section>
  );
}

function StudentDashboard({ student, token, onLogout, route = [], navigate = () => {} }) {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  // #/student/feedback survives a refresh; anything else is the dashboard.
  const view = route[1] === "feedback" ? "reports" : "dashboard";
  const setView = useCallback(
    (next) => navigate(["student", next === "reports" ? "feedback" : ""]),
    [navigate],
  );
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [focusReportId, setFocusReportId] = useState(null);

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
    return student.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [student.name]);

  const profileItems = [
    ["Phone", student.phone],
    ["Email", student.email || "Not added"],
    ["Stack", student.stack || "To be mapped"],
    ["Resume", student.resume_link ? "Available" : "Not added"],
  ];
  const summary = dashboard?.summary || {};
  const applications = dashboard?.applications || [];
  const shortlisted = dashboard?.shortlisted_applications || [];

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="side-brand">
          <ShieldCheck size={22} />
          <span>RSA</span>
        </div>
        <nav>
          <button
            type="button"
            className={view === "dashboard" ? "active" : ""}
            onClick={() => setView("dashboard")}
          >
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
            <FileText size={18} /> Interview Feedback
            {reports.length ? <span className="nav-count">{reports.length}</span> : null}
          </button>
        </nav>
        <button className="ghost-button" onClick={onLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Student Dashboard</p>
            <h1>Welcome, {student.name}</h1>
          </div>
          <div className="avatar" aria-label={student.name}>{initials}</div>
        </header>

        {view === "reports" ? (
          <StudentReportsView
            reports={reports}
            loading={loadingReports}
            focusId={focusReportId}
            token={token}
          />
        ) : (
        <>
        <section className="stats-grid">
          <Metric icon={<BriefcaseBusiness size={20} />} label="Applications" value={summary.total_applications ?? 0} />
          <Metric icon={<BadgeCheck size={20} />} label="Shortlisted" value={summary.shortlisted_count ?? 0} />
          <Metric icon={<XCircle size={20} />} label="Rejected" value={summary.rejected_count ?? 0} />
          <Metric
            icon={<FileText size={20} />}
            label="Feedback"
            value={reports.length}
            onClick={reports.length ? () => setView("reports") : undefined}
          />
        </section>

        {dashboardError ? <StatusMessage error={dashboardError} /> : null}

        <section className="content-grid">
          <div className="panel profile-panel">
            <div className="panel-title">
              <UserRound size={20} />
              <h2>Profile</h2>
            </div>
            <div className="profile-list">
              {profileItems.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              <CheckCircle2 size={20} />
              <h2>Interview Ready</h2>
            </div>
            {loadingDashboard ? (
              <PanelLoader />
            ) : shortlisted.length ? (
              <div className="shortlist-list">
                {shortlisted.slice(0, 4).map((application) => (
                  <ApplicationMini key={application.id} application={application} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Shortlisted opportunities will appear here.</p>
              </div>
            )}
          </div>

          <div className="panel wide">
            <div className="panel-title">
              <BriefcaseBusiness size={20} />
              <h2>My Applications</h2>
            </div>
            {loadingDashboard ? (
              <PanelLoader />
            ) : applications.length ? (
              <div className="applications-table with-feedback">
                <div className="applications-head">
                  <span>Company</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Links</span>
                  <span>Feedback</span>
                </div>
                {applications.map((application) => (
                  <ApplicationRow
                    key={application.id}
                    application={application}
                    report={reportByApplication[application.id]}
                    onOpenReport={openReport}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <p>No applications found for this student yet.</p>
              </div>
            )}
          </div>
        </section>
        </>
        )}
      </section>
    </main>
  );
}

function PanelLoader() {
  return (
    <div className="empty-state compact">
      <Loader2 className="spin" size={22} />
    </div>
  );
}

function statusClass(status) {
  if (status === "shortlisted" || status === "hired") return "good";
  if (status === "rejected" || status === "dropped" || status === "not_interested") return "bad";
  if (status === "interview_scheduled" || status === "in_progress") return "warn";
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
  const activeView = route[1] === "students" ? "students" : route[1] === "company" ? "company" : "overview";
  const companyId = route[1] === "company" ? route[2] || null : null;
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

  return (
    <main className="dashboard-shell">
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
        </nav>
        <button className="ghost-button" onClick={onLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="dashboard-main">
        {activeView === "company" ? (
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
        <header className="topbar">
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1>{activeView === "students" ? "Students" : "Hiring Pipeline Overview"}</h1>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={activeView === "students" ? loadStudents : loadDashboard}
            disabled={loading || loadingStudents}
            title="Refresh"
          >
            <RefreshCw className={loading || loadingStudents ? "spin" : ""} size={18} />
          </button>
        </header>

        {error ? <StatusMessage error={error} /> : null}

        {activeView === "students" ? (
          <AdminStudentsView students={students} loading={loadingStudents} />
        ) : (
          <>
            <section className="stats-grid admin-stats compact-stats">
              <Metric icon={<UsersRound size={20} />} label="Students" value={summary.total_students ?? 0} onClick={openStudentsView} />
              <Metric icon={<Building2 size={20} />} label="Companies" value={summary.total_companies ?? 0} />
              <Metric icon={<BriefcaseBusiness size={20} />} label="Opportunities" value={summary.total_opportunities ?? 0} />
            </section>

            <section className="content-grid admin-grid">
              <div className="panel wide">
                <div className="panel-title">
                  <BriefcaseBusiness size={20} />
                  <h2>Opportunities</h2>
                  {recentOpportunities.length ? <span className="title-count">{sortedOpportunities.length}</span> : null}
                </div>

                {recentOpportunities.length > 0 && (
                  <div className="opportunities-controls">
                    <div className="search-field">
                      <input
                        type="text"
                        placeholder="Search by company name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                      />
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
                          <option value="response_desc">Most Responses</option>
                          <option value="response_asc">Least Responses</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {loading ? (
                  <PanelLoader />
                ) : sortedOpportunities.length ? (
                  <div className="admin-table opportunities-table scrollable">
                    <div className="admin-head">
                      <span>Company</span>
                      <span>Role</span>
                      <span>Counts</span>
                      <span>Received</span>
                    </div>
                    {sortedOpportunities.map((opportunity) => (
                      <div className="admin-row" key={opportunity.id}>
                        <div>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => openCompany(opportunity.company)}
                            title="View company detail"
                          >
                            {opportunity.company?.name || "Company"}
                          </button>
                          <span>{opportunity.location || "Location not added"}</span>
                        </div>
                        <div>
                          <strong>{opportunity.role || "Role not mapped"}</strong>
                          <span>{opportunity.tech_stack || opportunity.must_have_skills || "Skills not mapped"}</span>
                        </div>
                        <div>
                          <strong>{opportunity.application_count ?? 0} applied</strong>
                          <span>{opportunity.shortlisted_count ?? 0} shortlisted / {opportunity.response_count ?? 0} responses</span>
                        </div>
                        <div>
                          <span>{formatDate(opportunity.opportunity_received_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact"><p>{searchTerm ? "No opportunities match your search." : "No opportunities found."}</p></div>
                )}
              </div>
            </section>
          </>
        )}
        </>
        )}
      </section>
    </main>
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
      <div className="rsa-questions">
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

/* --- Paste a response / shortlist sheet for this opening ----------- */
function SheetImportPanel({ adminToken, opportunityId, onImported }) {
  const [kind, setKind] = useState("responses");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setPreview(null);
    setApplied(null);
    setError("");
  }

  function switchKind(next) {
    setKind(next);
    setText("");
    reset();
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

  const counts = preview?.counts || {};
  const problems = (preview?.rows || []).filter((row) => row.action === "skip");

  return (
    <div className="panel wide">
      <div className="panel-title">
        <Upload size={20} />
        <h2>Import sheet data</h2>
      </div>
      <p className="rsa-hint">
        For sheets that couldn&apos;t be downloaded. Paste straight from Google Sheets — you&apos;ll see
        exactly what will change before anything is saved.
      </p>

      <div className="rsa-tabs">
        <button type="button" className={kind === "responses" ? "active" : ""} onClick={() => switchKind("responses")}>
          Student responses
        </button>
        <button type="button" className={kind === "shortlist" ? "active" : ""} onClick={() => switchKind("shortlist")}>
          Shortlist
        </button>
      </div>

      {error ? <StatusMessage error={error} /> : null}

      {applied ? (
        <div className="status success" style={{ marginBottom: 12 }}>
          <BadgeCheck size={18} />
          <span>
            Imported {applied.counts.rows} row(s):{" "}
            {kind === "responses"
              ? `${applied.counts.applications_to_create} created, ${applied.counts.applications_to_update} updated, ${applied.counts.students_to_create} new students`
              : `${applied.counts.applications_to_mark} marked shortlisted, ${applied.counts.applications_to_create} created`}
            {applied.counts.status_preserved
              ? ` · ${applied.counts.status_preserved} kept their existing status`
              : ""}
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
      ) : (
        <>
          <div className="rsa-detected">
            <div><span>Rows read</span><strong>{counts.rows ?? 0}</strong></div>
            <div>
              <span>{kind === "responses" ? "Applications to create" : "To mark shortlisted"}</span>
              <strong>{kind === "responses" ? counts.applications_to_create ?? 0 : counts.applications_to_mark ?? 0}</strong>
            </div>
            <div>
              <span>{kind === "responses" ? "To update" : "New applications"}</span>
              <strong>{kind === "responses" ? counts.applications_to_update ?? 0 : counts.applications_to_create ?? 0}</strong>
            </div>
            {kind === "responses" ? (
              <div><span>New students</span><strong>{counts.students_to_create ?? 0}</strong></div>
            ) : (
              <div><span>Unmatched (skipped)</span><strong>{counts.unmatched ?? 0}</strong></div>
            )}
          </div>

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
                {counts.unmatched} row(s) don&apos;t match anyone who applied to this opening and will
                be skipped. Shortlist imports never create students — import their response sheet
                first.
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
            {(preview.rows || []).slice(0, 60).map((row) => (
              <div className="rsa-preview-row" key={row.row}>
                <span className="muted">{row.row}</span>
                <div>
                  <strong>{row.name || "(no name)"}</strong>
                  <span>{row.email || row.phone || "no contact"}</span>
                </div>
                <span className={`status-pill ${row.action === "skip" ? "bad" : row.action.includes("create") ? "neutral" : "good"}`}>
                  {row.action.replaceAll("_", " ")}
                </span>
                <span className="muted">
                  {row.matched_via === "name" ? <em>matched by name · </em> : null}
                  {row.status_preserved_from ? `keeps ${row.status_preserved_from}` : row.status || row.willing_to_join || ""}
                </span>
              </div>
            ))}
            {(preview.rows || []).length > 60 ? (
              <p className="muted" style={{ padding: 10 }}>
                …and {preview.rows.length - 60} more rows.
              </p>
            ) : null}
          </div>

          <div className="rsa-actions">
            <button className="back-button" type="button" onClick={reset} disabled={busy}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="primary-button" type="button" onClick={handleConfirm} disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <BadgeCheck size={18} />}
              Confirm import
            </button>
          </div>
        </>
      )}
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

  function reset() {
    setStage("idle");
    setProposal(null);
    setRawText("");
    setReports([]);
    setAnalysis(null);
    setError("");
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
                  <button type="button" className="rsa-session" key={session.id} onClick={() => openSession(session.id)}>
                    <div>
                      <strong>{session.round_name || "Interview"}</strong>
                      <span>{session.students?.length || 0} candidates · {formatDate(session.scheduled_at)}</span>
                    </div>
                    <span className={`status-pill ${session.ai_status === "completed" ? "good" : "neutral"}`}>
                      {session.ai_status || "not started"}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
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
              <div className="rsa-reports">
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

  // Filter applicants
  const filteredApplicants = applicants.filter((applicant) => {
    const student = applicant.student || {};
    const searchLower = searchStudent.toLowerCase();
    const matchesSearch =
      (student.name || "").toLowerCase().includes(searchLower) ||
      (student.phone || "").includes(searchStudent) ||
      (student.email || "").toLowerCase().includes(searchLower);
    const matchesStatus = filterStatus === "all" || (applicant.status || "applied") === filterStatus;
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
                    <option value="applied">Applied</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="rejected">Rejected</option>
                    <option value="hired">Hired</option>
                    <option value="dropped">Dropped</option>
                    <option value="interview_scheduled">Interview Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="not_interested">Not Interested</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {applicantsOpen ? (
            filteredApplicants.length ? (
              <div className="admin-table applicants-table">
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

function AdminStudentsView({ students, loading }) {
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
        <div className="admin-table students-table">
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
                    <strong>{student.name || "Student"}</strong>
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
