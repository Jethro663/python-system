import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, UserRound, UsersRound } from "lucide-react";

import { StudentPageShell, StudentSectionCard } from "../components/student/StudentPageShell";
import { studentApi } from "../lib/api";

export default function StudentProfilePage() {
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    school_id: "",
    email: "",
    grade_level: "",
    guardian_name: "",
    guardian_contact: "",
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
    studentApi
      .profile()
      .then((data) => {
        setProfileForm({
          first_name: data.profile.first_name || "",
          last_name: data.profile.last_name || "",
          school_id: data.profile.school_id || "",
          email: data.profile.email || "",
          grade_level: data.profile.grade_level || "",
          guardian_name: data.profile.guardian_name || "",
          guardian_contact: data.profile.guardian_contact || "",
        });
      })
      .catch((profileError) => setError(profileError.message));
  }, []);

  const initials = useMemo(
    () => `${profileForm.first_name?.[0] || "S"}${profileForm.last_name?.[0] || "T"}`.toUpperCase(),
    [profileForm.first_name, profileForm.last_name]
  );

  return (
    <StudentPageShell
      badge="Student Profile"
      title="Editable account details"
      description="Manage your student identity, guardian contact, and password from the student sidebar."
      icon={UserRound}
      meta={
        <>
          <span>{profileForm.grade_level || "grade pending"}</span>
          <span>{profileForm.school_id || "no school ID"}</span>
          <span>{profileForm.guardian_contact || "guardian contact pending"}</span>
        </>
      }
      metrics={[
        { label: "Student ID", value: profileForm.school_id || "-", caption: "Current student record" },
        { label: "Grade Level", value: profileForm.grade_level || "-", caption: "Academic profile" },
        { label: "Email", value: profileForm.email || "-", caption: "Primary login identity" },
      ]}
    >
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="student-profile-grid">
        <StudentSectionCard
          eyebrow="Profile"
          title="Identity and guardian details"
          description="Update the information shown on your student account."
          actions={<span className="admin-tag-chip">Identity</span>}
        >
          <div className="admin-user-lifecycle">
            <div className="admin-user-lifecycle__hero">
              <div className="admin-user-lifecycle__avatar">{initials}</div>
              <div className="admin-user-lifecycle__copy">
                <strong>{[profileForm.first_name, profileForm.last_name].filter(Boolean).join(" ") || "Student"}</strong>
                <span>{profileForm.email || "No email loaded yet"}</span>
                <div className="admin-user-lifecycle__meta">
                  <span className="admin-tag-chip">{profileForm.grade_level || "Grade pending"}</span>
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
                  const data = await studentApi.updateProfile(profileForm);
                  setProfileForm({
                    first_name: data.profile.first_name || "",
                    last_name: data.profile.last_name || "",
                    school_id: data.profile.school_id || "",
                    email: data.profile.email || "",
                    grade_level: data.profile.grade_level || "",
                    guardian_name: data.profile.guardian_name || "",
                    guardian_contact: data.profile.guardian_contact || "",
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
                    <span>Your name and email are used across the student portal.</span>
                  </div>
                </article>
                <article className="admin-mini-callout">
                  <UsersRound size={18} />
                  <div>
                    <strong>Guardian contact</strong>
                    <span>Keep guardian details current for school follow-up.</span>
                  </div>
                </article>
              </div>

              {[
                ["first_name", "First name"],
                ["last_name", "Last name"],
                ["school_id", "School ID"],
                ["email", "Email"],
                ["grade_level", "Grade level"],
                ["guardian_name", "Guardian name"],
                ["guardian_contact", "Guardian contact"],
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
        </StudentSectionCard>

        <StudentSectionCard
          eyebrow="Security"
          title="Password change"
          description="Update your student login credentials without leaving the profile page."
          actions={<span className="admin-tag-chip">Security</span>}
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSavingPassword(true);
              setError("");
              setSuccess("");
              try {
                await studentApi.changeProfilePassword(passwordForm);
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
                  <span>Changing this password updates the credentials used for student access.</span>
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
        </StudentSectionCard>
      </div>
    </StudentPageShell>
  );
}
