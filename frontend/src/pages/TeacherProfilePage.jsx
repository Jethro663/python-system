import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, LockKeyhole, UserRound } from "lucide-react";

import { TeacherPageShell, TeacherSectionCard } from "../components/teacher/TeacherPageShell";
import { teacherApi } from "../lib/api";

export default function TeacherProfilePage() {
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    school_id: "",
    email: "",
    department: "",
    phone: "",
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
    teacherApi
      .profile()
      .then((data) => {
        setProfileForm({
          first_name: data.profile.first_name || "",
          last_name: data.profile.last_name || "",
          school_id: data.profile.school_id || "",
          email: data.profile.email || "",
          department: data.profile.department || "",
          phone: data.profile.phone || "",
        });
      })
      .catch((profileError) => setError(profileError.message));
  }, []);

  const initials = useMemo(
    () => `${profileForm.first_name?.[0] || "T"}${profileForm.last_name?.[0] || "R"}`.toUpperCase(),
    [profileForm.first_name, profileForm.last_name]
  );

  return (
    <TeacherPageShell
      badge="Teacher Profile"
      title="Account and department details"
      description="This page now follows the same card rhythm as the copied teacher workspace while keeping the current editable account flow."
      icon={UserRound}
      headerMeta={
        <>
          <span>{profileForm.department || "department pending"}</span>
          <span>{profileForm.school_id || "no school ID"}</span>
          <span>{profileForm.phone || "no phone"}</span>
        </>
      }
      metrics={[
        { label: "Department", value: profileForm.department || "-", caption: "Current teacher assignment" },
        { label: "School ID", value: profileForm.school_id || "-", caption: "Teacher record reference" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="teacher-two-column">
        <TeacherSectionCard
          eyebrow="Profile"
          title="Identity and contact details"
          description="Update your teacher-facing name, email, department, and contact information."
          action={<span className="admin-tag-chip">Identity</span>}
        >
          <div className="admin-user-lifecycle">
            <div className="admin-user-lifecycle__hero">
              <div className="admin-user-lifecycle__avatar admin-user-lifecycle__avatar--teacher">
                {initials}
              </div>
              <div className="admin-user-lifecycle__copy">
                <strong>{[profileForm.first_name, profileForm.last_name].filter(Boolean).join(" ") || "Teacher"}</strong>
                <span>{profileForm.email || "No email loaded yet"}</span>
                <div className="admin-user-lifecycle__meta">
                  <span className="admin-tag-chip">{profileForm.department || "Department pending"}</span>
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
                  const data = await teacherApi.updateProfile(profileForm);
                  setProfileForm({
                    first_name: data.profile.first_name || "",
                    last_name: data.profile.last_name || "",
                    school_id: data.profile.school_id || "",
                    email: data.profile.email || "",
                    department: data.profile.department || "",
                    phone: data.profile.phone || "",
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
                    <strong>Visible identity</strong>
                    <span>These details reinforce the teacher shell and the records teachers work from daily.</span>
                  </div>
                </article>
                <article className="admin-mini-callout">
                  <BriefcaseBusiness size={18} />
                  <div>
                    <strong>Department signal</strong>
                    <span>Keep the department current so administrative and teacher-facing identity stays coherent.</span>
                  </div>
                </article>
              </div>

              {[
                ["first_name", "First name"],
                ["last_name", "Last name"],
                ["school_id", "School ID"],
                ["email", "Email"],
                ["department", "Department"],
                ["phone", "Phone"],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    name={String(key)}
                    value={profileForm[key]}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}

              <button className="primary-button" type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save profile"}
              </button>
            </form>
          </div>
        </TeacherSectionCard>

        <TeacherSectionCard
          eyebrow="Security"
          title="Password change"
          description="Update teacher access credentials without leaving the profile shell."
          action={<span className="admin-tag-chip">Security</span>}
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSavingPassword(true);
              setError("");
              setSuccess("");
              try {
                await teacherApi.changeProfilePassword(passwordForm);
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
                  <strong>Account security</strong>
                  <span>Changing this password updates the same credentials used for daily teacher access.</span>
                </div>
              </article>
            </div>

            <label className="field">
              <span>Current password</span>
              <input
                name="current_password"
                type="password"
                autoComplete="current-password"
                value={passwordForm.current_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, current_password: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>New password</span>
              <input
                name="new_password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.new_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, new_password: event.target.value }))
                }
              />
            </label>

            <button className="primary-button" type="submit" disabled={savingPassword}>
              {savingPassword ? "Saving..." : "Change password"}
            </button>
          </form>
        </TeacherSectionCard>
      </div>
    </TeacherPageShell>
  );
}
