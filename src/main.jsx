import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
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
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const ACCESS_TOKEN_KEY = "rsa_student_access_token";
const ADMIN_TOKEN_KEY = "rsa_admin_token";

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
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [mode, setMode] = useState(() => (localStorage.getItem(ADMIN_TOKEN_KEY) ? "admin" : "student"));
  const [student, setStudent] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(Boolean(token) && mode === "student");
  const [authView, setAuthView] = useState("login");

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
  }

  function handleAdminAuthenticated(value) {
    localStorage.setItem(ADMIN_TOKEN_KEY, value);
    setAdminToken(value);
    setMode("admin");
  }

  function handleAdminLogout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
    setMode("student");
  }

  if (loadingStudent) {
    return <LoadingScreen />;
  }

  if (mode === "admin") {
    if (!adminToken) {
      return <AdminAccess onAuthenticated={handleAdminAuthenticated} onStudentMode={() => setMode("student")} />;
    }
    return <AdminDashboard adminToken={adminToken} onLogout={handleAdminLogout} />;
  }

  if (!token || !student) {
    return (
      <AuthScreen
        authView={authView}
        setAuthView={setAuthView}
        onAuthenticated={handleAuthenticated}
        onAdminMode={() => setMode("admin")}
      />
    );
  }

  return <StudentDashboard student={student} token={token} onLogout={handleLogout} />;
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

function StudentDashboard({ student, token, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [loadingDashboard, setLoadingDashboard] = useState(true);

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
          <a className="active"><BarChart3 size={18} /> Dashboard</a>
          <a><FileText size={18} /> Interview Reports</a>
          <a><BookOpenCheck size={18} /> Practice Bank</a>
          <a><BriefcaseBusiness size={18} /> Projects</a>
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

        <section className="stats-grid">
          <Metric icon={<BriefcaseBusiness size={20} />} label="Applications" value={summary.total_applications ?? 0} />
          <Metric icon={<BadgeCheck size={20} />} label="Shortlisted" value={summary.shortlisted_count ?? 0} />
          <Metric icon={<XCircle size={20} />} label="Rejected" value={summary.rejected_count ?? 0} />
          <Metric icon={<Trophy size={20} />} label="Hired" value={summary.hired_count ?? 0} />
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
              <div className="applications-table">
                <div className="applications-head">
                  <span>Company</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Links</span>
                </div>
                {applications.map((application) => (
                  <ApplicationRow key={application.id} application={application} />
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <p>No applications found for this student yet.</p>
              </div>
            )}
          </div>
        </section>
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

function ApplicationRow({ application }) {
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
            <a key={label} href={href} target="_blank" rel="noreferrer" title={label}>
              <ExternalLink size={16} />
              {label}
            </a>
          ))
        ) : (
          <span className="muted">No links</span>
        )}
      </div>
    </div>
  );
}

function AdminDashboard({ adminToken, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [activeView, setActiveView] = useState("overview");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

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
    setActiveView("students");
    if (!students.length) loadStudents();
  }

  useEffect(() => {
    loadDashboard();
  }, [adminToken]);

  const summary = dashboard?.summary || {};
  const recentOpportunities = dashboard?.recent_opportunities || [];

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="side-brand">
          <ShieldCheck size={22} />
          <span>RSA Admin</span>
        </div>
        <nav>
          <button className={activeView === "overview" ? "active" : ""} type="button" onClick={() => setActiveView("overview")}>
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
          <AdminStudentsView
            students={students}
            loading={loadingStudents}
            onSelectStudent={setSelectedStudent}
          />
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
                  <h2>Recent Opportunities</h2>
                </div>
                {loading ? (
                  <PanelLoader />
                ) : recentOpportunities.length ? (
                  <div className="admin-table opportunities-table">
                    <div className="admin-head">
                      <span>Company</span>
                      <span>Role</span>
                      <span>Counts</span>
                      <span>Received</span>
                    </div>
                    {recentOpportunities.map((opportunity) => (
                      <div className="admin-row" key={opportunity.id}>
                        <div>
                          <strong>{opportunity.company?.name || "Company"}</strong>
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
                  <div className="empty-state compact"><p>No opportunities found.</p></div>
                )}
              </div>
            </section>
          </>
        )}
      </section>

      {selectedStudent ? (
        <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      ) : null}
    </main>
  );
}

function AdminStudentsView({ students, loading, onSelectStudent }) {
  if (loading) return <PanelLoader />;

  return (
    <section className="panel wide">
      <div className="panel-title">
        <UsersRound size={20} />
        <h2>All Students</h2>
      </div>
      {students.length ? (
        <div className="admin-table students-table">
          <div className="admin-head">
            <span>Student</span>
            <span>Education</span>
            <span>Applied</span>
            <span>Shortlisted</span>
            <span>Not Shortlisted</span>
          </div>
          {students.map((student) => (
            <div className="admin-row student-row" key={student.id}>
              <div>
                <strong>{student.name || "Student"}</strong>
                <span>{student.phone || student.email || "Contact not added"}</span>
              </div>
              <div>
                <strong>{student.college || "College not added"}</strong>
                <span>{[student.degree, student.department, student.year_of_passing].filter(Boolean).join(" / ") || "Education not added"}</span>
              </div>
              <button type="button" className="table-count" onClick={() => onSelectStudent(student)}>
                {student.application_count ?? 0}
              </button>
              <button type="button" className="table-count good" onClick={() => onSelectStudent({ ...student, detailMode: "shortlisted" })}>
                {student.shortlisted_count ?? 0}
              </button>
              <button type="button" className="table-count warn" onClick={() => onSelectStudent({ ...student, detailMode: "not_shortlisted" })}>
                {student.not_shortlisted_count ?? 0}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state compact"><p>No students found.</p></div>
      )}
    </section>
  );
}

function StudentDetailModal({ student, onClose }) {
  const mode = student.detailMode || "all";
  const applications =
    mode === "shortlisted"
      ? student.shortlisted_applications || []
      : mode === "not_shortlisted"
        ? student.not_shortlisted_applications || []
        : student.applications || [];
  const title =
    mode === "shortlisted"
      ? "Shortlisted Companies"
      : mode === "not_shortlisted"
        ? "Not Shortlisted Companies"
        : "Applied Companies";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{student.name}</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Close">
            <XCircle size={18} />
          </button>
        </div>
        {applications.length ? (
          <div className="modal-list">
            {applications.map((application) => (
              <AdminApplicationRow key={application.id} application={application} />
            ))}
          </div>
        ) : (
          <div className="empty-state compact"><p>No companies found for this view.</p></div>
        )}
      </section>
    </div>
  );
}

function AdminApplicationRow({ application }) {
  const hasStudent = Boolean(application.student);
  const links = [
    ["Resume", application.resume_link],
    ["Project", application.project_link],
    ["GitHub", application.github_link],
  ].filter(([, href]) => Boolean(href));

  return (
    <div className="admin-row">
      <div>
        <strong>{hasStudent ? application.student?.name : application.company?.name || "Company"}</strong>
        <span>{hasStudent ? application.student?.phone || application.student?.email || "Contact not added" : application.opportunity?.location || "Location not added"}</span>
      </div>
      <div>
        <strong>{hasStudent ? application.company?.name || "Company" : application.opportunity?.role || "Role not mapped"}</strong>
        <span>{hasStudent ? application.opportunity?.role || "Role not mapped" : application.opportunity?.tech_stack || application.opportunity?.must_have_skills || "Skills not mapped"}</span>
      </div>
      <div>
        <span className={`status-pill ${statusClass(application.status)}`}>{formatStatus(application.status)}</span>
        <span>{formatDate(application.applied_at)}</span>
      </div>
      <div className="link-group">
        {links.length ? (
          links.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" title={label}>
              <ExternalLink size={16} />
              {label}
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
