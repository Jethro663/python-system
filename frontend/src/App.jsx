import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import AppShell from "./components/AppShell";
import LoginPage from "./components/LoginPage";
import { useAuth } from "./context/AuthContext";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminAuditPage from "./pages/AdminAuditPage";
import AdminCalendarPage from "./pages/AdminCalendarPage";
import AdminLibraryPage from "./pages/AdminLibraryPage";
import AdminRosterImportPage from "./pages/AdminRosterImportPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import AdminSectionsPage from "./pages/AdminSectionsPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminStudentsPage from "./pages/AdminStudentsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import StudentClassesPage from "./pages/StudentClassesPage";
import StudentClassWorkspacePage from "./pages/StudentClassWorkspacePage";
import StudentHomePage from "./pages/StudentHomePage";
import StudentProfilePage from "./pages/StudentProfilePage";
import StudentResultsPage from "./pages/StudentResultsPage";
import TeacherCalendarPage from "./pages/TeacherCalendarPage";
import TeacherClassesPage from "./pages/TeacherClassesPage";
import TeacherClassWorkspacePage from "./pages/TeacherClassWorkspacePage";
import TeacherHomePage from "./pages/TeacherHomePage";
import TeacherPerformancePage from "./pages/TeacherPerformancePage";
import TeacherProfilePage from "./pages/TeacherProfilePage";
import TeacherRecordsPage from "./pages/TeacherRecordsPage";
import TeacherRosterPage from "./pages/TeacherRosterPage";
import TeacherResultsPage from "./pages/TeacherResultsPage";
import TeacherResourcesPage from "./pages/TeacherResourcesPage";
import TeacherReportsPage from "./pages/TeacherReportsPage";

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return <div className="app-loader">Loading portal...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function RoleLanding() {
  const { user } = useAuth();
  return <Navigate to={`/${user.role}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleLanding />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sections"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminSectionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/calendar"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/library"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLibraryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roster-import"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminRosterImportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminStudentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminAuditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/classes"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/classes/:sectionId"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherClassWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/roster"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherRosterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/records"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherRecordsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/results"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherResultsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/performance"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherPerformancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/reports"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/calendar"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/resources"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherResourcesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/profile"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/classes"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/classes/:sectionId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentClassWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/results"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentResultsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentProfilePage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
