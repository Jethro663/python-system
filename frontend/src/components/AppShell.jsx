import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

const NAV_SECTIONS = {
  admin: [
    {
      id: "overview",
      label: "Overview",
      items: [
        { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/reports", label: "Reports", icon: BarChart3 },
        { to: "/admin/audit", label: "Audit Trail", icon: History },
      ],
    },
    {
      id: "school-setup",
      label: "School Setup",
      items: [
        { to: "/admin/users", label: "Users", icon: Users },
        { to: "/admin/sections", label: "Sections", icon: BookOpen },
        { to: "/admin/roster-import", label: "Roster Import", icon: ClipboardList },
        { to: "/admin/students", label: "Student Records", icon: FileSpreadsheet },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
        { to: "/admin/library", label: "Nexora Library", icon: FolderOpen },
        { to: "/admin/settings", label: "System Settings", icon: Settings },
        { to: "/admin/profile", label: "Profile", icon: User },
      ],
    },
  ],
  teacher: [
    {
      id: "teaching",
      label: "Teaching",
      items: [
        { to: "/teacher", label: "Dashboard", icon: LayoutDashboard },
        { to: "/teacher/classes", label: "My Classes", icon: BookOpen },
        { to: "/teacher/roster", label: "Roster", icon: Users },
        { to: "/teacher/calendar", label: "Calendar", icon: CalendarDays },
      ],
    },
    {
      id: "records",
      label: "Content & Records",
      items: [
        { to: "/teacher/records", label: "Class Records", icon: ClipboardList },
        { to: "/teacher/results", label: "Results", icon: FileSpreadsheet },
        { to: "/teacher/resources", label: "Resources", icon: FolderOpen },
      ],
    },
    {
      id: "insights",
      label: "Insights",
      items: [
        { to: "/teacher/performance", label: "Performance", icon: BarChart3 },
        { to: "/teacher/reports", label: "Reports", icon: ShieldCheck },
        { to: "/teacher/profile", label: "Profile", icon: User },
      ],
    },
  ],
  student: [
    {
      id: "learning",
      label: "Learning",
      items: [
        { to: "/student", label: "Dashboard", icon: LayoutDashboard },
        { to: "/student/classes", label: "My Classes", icon: BookOpen },
        { to: "/student/results", label: "Results", icon: FileSpreadsheet },
      ],
    },
  ],
};

function getRoleTitle(role) {
  switch (role) {
    case "admin":
      return "Admin Portal";
    case "teacher":
      return "Teacher Portal";
    default:
      return "Student Portal";
  }
}

function getRoleWelcome(role) {
  switch (role) {
    case "admin":
      return "School control center";
    case "teacher":
      return "Teaching workspace";
    default:
      return "Learning workspace";
  }
}

function getDisplayName(user) {
  return user?.full_name || user?.name || user?.email || "Portal User";
}

function getInitials(user) {
  const source = getDisplayName(user);
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "NU";
}

function isActivePath(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role || "student";
  const sections = NAV_SECTIONS[role] || NAV_SECTIONS.student;
  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  const activeSectionIds = useMemo(
    () =>
      sections
        .filter((section) => section.items.some((item) => isActivePath(location.pathname, item.to)))
        .map((section) => section.id),
    [location.pathname, sections],
  );
  const activeItem = useMemo(
    () =>
      sections
        .flatMap((section) => section.items.map((item) => ({ ...item, sectionLabel: section.label })))
        .find((item) => isActivePath(location.pathname, item.to)) || null,
    [location.pathname, sections],
  );

  const shellRoleClass =
    role === "admin"
      ? "admin"
      : role === "teacher"
        ? "teacher"
        : "student";

  return (
    <div className={`portal-layout portal-layout--${shellRoleClass}`}>
      <div
        className={`portal-layout__backdrop${mobileOpen ? " portal-layout__backdrop--open" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`portal-sidebar portal-sidebar--${shellRoleClass}${mobileOpen ? " portal-sidebar--open" : ""}`}
      >
        <div className="portal-sidebar__header">
          <div className="portal-sidebar__brand">
            <div className="portal-sidebar__logo">
              <BookOpen size={18} />
            </div>
            <div className="portal-sidebar__brand-copy">
              <span className="portal-sidebar__brand-kicker">Unified Campus Workspace</span>
              <h1 className="portal-sidebar__title">Nexora</h1>
              <p className="portal-sidebar__subtitle">{getRoleTitle(role)}</p>
              <div className="portal-sidebar__brand-meta">
                <span>{getRoleWelcome(role)}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="portal-sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="portal-sidebar__nav">
          {sections.map((section) => (
            <section className="portal-sidebar__section" key={section.id}>
              <p
                className={`portal-sidebar__section-label${
                  activeSectionIds.includes(section.id) ? " portal-sidebar__section-label--active" : ""
                }`}
              >
                {section.label}
              </p>
              <div className="portal-sidebar__items">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `portal-sidebar__item${isActive ? " portal-sidebar__item--active" : ""}`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    <item.icon className="portal-sidebar__item-icon" size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="portal-sidebar__footer">
          <div className="portal-sidebar__profile">
            <div className="portal-sidebar__avatar">{initials}</div>
            <div className="portal-sidebar__profile-copy">
              <p className="portal-sidebar__profile-name">{displayName}</p>
              <p className="portal-sidebar__profile-meta">{getRoleTitle(role)}</p>
              {activeItem ? (
                <span className="portal-sidebar__profile-route">
                  {activeItem.sectionLabel} / {activeItem.label}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="portal-sidebar__logout"
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="portal-main">
        <header className={`portal-topbar portal-topbar--${shellRoleClass}`}>
          <div className="portal-topbar__left">
            <button
              type="button"
              className="portal-topbar__menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="portal-topbar__welcome">
              {activeItem ? (
                <div className="portal-topbar__context">
                  <span className="portal-topbar__context-pill">{activeItem.sectionLabel}</span>
                  <span className="portal-topbar__context-route">{activeItem.label}</span>
                </div>
              ) : null}
              <p className="portal-topbar__title">
                Welcome back, <span>{displayName.split(" ")[0] || displayName}</span>
              </p>
              <p className="portal-topbar__subtitle">{getRoleWelcome(role)}</p>
            </div>
          </div>

          <div className="portal-topbar__profile">
            <div className="portal-topbar__status">
              <span className="portal-topbar__status-pill">{getRoleTitle(role)}</span>
              <span className="portal-topbar__status-note">Live workspace</span>
            </div>
            <div className="portal-topbar__avatar">{initials}</div>
            <div className="portal-topbar__profile-copy">
              <span className="portal-topbar__profile-name">{displayName}</span>
              <span className="portal-topbar__profile-role">{getRoleTitle(role)}</span>
            </div>
          </div>
        </header>

        <main className="portal-main__content">{children}</main>
      </div>
    </div>
  );
}
