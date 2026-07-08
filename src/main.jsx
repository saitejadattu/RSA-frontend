import React, { useEffect, useMemo, useState } from "react";
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
  const [companyId, setCompanyId] = useState(null);
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

  function openCompany(company) {
    if (!company?.id) return;
    setCompanyId(company.id);
    setActiveView("company");
  }

  function backToOverview() {
    setActiveView("overview");
    setCompanyId(null);
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
        {activeView === "company" ? (
          <CompanyDetailView adminToken={adminToken} companyId={companyId} onBack={backToOverview} />
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
                  {recentOpportunities.length ? <span className="title-count">{recentOpportunities.length}</span> : null}
                </div>
                {loading ? (
                  <PanelLoader />
                ) : recentOpportunities.length ? (
                  <div className="admin-table opportunities-table scrollable">
                    <div className="admin-head">
                      <span>Company</span>
                      <span>Role</span>
                      <span>Counts</span>
                      <span>Received</span>
                    </div>
                    {recentOpportunities.map((opportunity) => (
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
                  <div className="empty-state compact"><p>No opportunities found.</p></div>
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

function CompanyDetailView({ adminToken, companyId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOppId, setSelectedOppId] = useState(null);
  const [oppData, setOppData] = useState(null);
  const [loadingOpp, setLoadingOpp] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    setSelectedOppId(null);
    setOppData(null);
    apiRequest(`/admin/companies/${companyId}`, { adminToken })
      .then((detail) => {
        if (!live) return;
        setData(detail);
        if (detail.opportunity_count === 1 && detail.opportunities?.[0]) {
          setSelectedOppId(detail.opportunities[0].id);
        }
      })
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [companyId, adminToken]);

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
  }, [selectedOppId, adminToken]);

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
            <OpportunityChooser opportunities={opportunities} onSelect={setSelectedOppId} />
          ) : null}

          {selectedOppId ? (
            <>
              {multi ? (
                <button type="button" className="back-button subtle" onClick={() => setSelectedOppId(null)}>
                  <ArrowLeft size={16} /> Other opportunities ({data.opportunity_count})
                </button>
              ) : null}
              {loadingOpp || !oppData ? <PanelLoader /> : <OpportunityDetail detail={oppData} />}
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

function OpportunityDetail({ detail }) {
  const o = detail.opportunity || {};
  const stats = detail.stats || {};
  const applicants = detail.applicants || [];

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
                <a key={label} href={href} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} />
                  {label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="panel wide">
          <div className="panel-title">
            <UsersRound size={20} />
            <h2>Applicants</h2>
            <span className="title-count">{applicants.length}</span>
          </div>
          {applicants.length ? (
            <div className="admin-table applicants-table">
              <div className="admin-head">
                <span>Student</span>
                <span>Status</span>
                <span>Applied</span>
                <span>Links</span>
              </div>
              {applicants.map((applicant) => (
                <ApplicantRow key={applicant.id} application={applicant} />
              ))}
            </div>
          ) : (
            <div className="empty-state compact"><p>No applicants yet.</p></div>
          )}
        </div>
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
            <a key={label} href={href} target="_blank" rel="noreferrer" title={label}>
              <ExternalLink size={14} />
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

  return (
    <section className="panel wide">
      <div className="panel-title">
        <UsersRound size={20} />
        <h2>All Students</h2>
        {students.length ? <span className="title-count">{students.length}</span> : null}
      </div>
      {students.length ? (
        <div className="admin-table students-table">
          <div className="admin-head">
            <span>Student</span>
            <span>Applied</span>
            <span>Shortlisted</span>
            <span>Not Shortlisted</span>
          </div>
          {students.map((student) => {
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
        <div className="empty-state compact"><p>No students found.</p></div>
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
            <a key={label} href={href} target="_blank" rel="noreferrer" title={label}>
              <ExternalLink size={14} />
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
