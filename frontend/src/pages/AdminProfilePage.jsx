import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";

import { AdminPageShell, AdminSectionCard } from "../components/admin/AdminPageShell";
import { adminApi } from "../lib/api";

export default function AdminProfilePage() {
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    school_id: "",
    email: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    adminApi
      .profile()
      .then((data) => {
        setProfileForm({
          first_name: data.profile.first_name || "",
          last_name: data.profile.last_name || "",
          school_id: data.profile.school_id || "",
          email: data.profile.email || "",
        });
      })
      .catch((profileError) => setError(profileError.message));
  }, []);

  const initials = useMemo(
    () => `${profileForm.first_name?.[0] || "A"}${profileForm.last_name?.[0] || "D"}`.toUpperCase(),
    [profileForm.first_name, profileForm.last_name]
  );

  return (
    <AdminPageShell
      badge="Admin Profile"
      title="Editable account details"
      description="This keeps the admin account settings in the same role-shell structure as the updated teacher and student surfaces."
      metrics={[
        { label: "Admin ID", value: profileForm.school_id || "-", caption: "Current administrator record" },
        { label: "Email", value: profileForm.email || "-", caption: "Primary login identity" },
      ]}
    >
      <div className="page-grid page-grid--admin">
        <AdminSectionCard
          eyebrow="Admin Profile"
          title="Identity and account details"
          description="Update the administrator identity used across the portal."
        >
          <div className="admin-user-lifecycle">
            <div className="admin-user-lifecycle__hero">
              <div className="admin-user-lifecycle__avatar admin-user-lifecycle__avatar--admin">
                {initials}
              </div>
              <div className="admin-user-lifecycle__copy">
                <strong>{[profileForm.first_name, profileForm.last_name].filter(Boolean).join(" ") || "Administrator"}</strong>
                <span>{profileForm.email || "No email loaded yet"}</span>
                <div className="admin-user-lifecycle__meta">
                  <span className="admin-tag-chip">Administrator</span>
                  <span className="admin-tag-chip">{profileForm.school_id || "No school ID"}</span>
                </div>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault();
                setSavingProfile(true);
                setError("");
                setSuccess("");
                try {
                  const data = await adminApi.updateProfile(profileForm);
                  setProfileForm({
                    first_name: data.profile.first_name || "",
                    last_name: data.profile.last_name || "",
                    school_id: data.profile.school_id || "",
                    email: data.profile.email || "",
                  });
                  setSuccess("Profile updated.");
                } catch (profileError) {
                  setError(profileError.message);
                } finally {
                  setSavingProfile(false);
                }
              }}
            >
              <div className="admin-form-callout-grid">
                <article className="admin-mini-callout">
                  <UserRound size={18} />
                  <div>
                    <strong>Identity surface</strong>
                    <span>These details appear anywhere the admin account is reflected in the portal shell.</span>
                  </div>
                </article>
                <article className="admin-mini-callout">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Role stability</strong>
                    <span>This account remains an administrator even as you refresh the visible profile details.</span>
                  </div>
                </article>
              </div>

              {[
                ["first_name", "First name"],
                ["last_name", "Last name"],
                ["school_id", "School ID"],
                ["email", "Email"],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    value={profileForm[key]}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}

              {error ? <div className="form-error">{error}</div> : null}
              {success ? <div className="form-success">{success}</div> : null}

              <button className="primary-button" type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save profile"}
              </button>
            </form>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          eyebrow="Password Change"
          title="Update administrator access"
          description="Change the admin password without leaving the role shell."
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSavingPassword(true);
              setError("");
              setSuccess("");
              try {
                await adminApi.changeProfilePassword(passwordForm);
                setPasswordForm({ current_password: "", new_password: "" });
                setSuccess("Password updated.");
              } catch (passwordError) {
                setError(passwordError.message);
              } finally {
                setSavingPassword(false);
              }
            }}
          >
            <div className="admin-form-callout-grid">
              <article className="admin-mini-callout">
                <LockKeyhole size={18} />
                <div>
                  <strong>Security control</strong>
                  <span>Changing this password affects the main admin login used to manage the platform.</span>
                </div>
              </article>
            </div>

            <label className="field">
              <span>Current password</span>
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    current_password: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field">
              <span>New password</span>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    new_password: event.target.value,
                  }))
                }
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}
            {success ? <div className="form-success">{success}</div> : null}

            <button className="primary-button" type="submit" disabled={savingPassword}>
              {savingPassword ? "Saving..." : "Change password"}
            </button>
          </form>
        </AdminSectionCard>
      </div>
    </AdminPageShell>
  );
}
