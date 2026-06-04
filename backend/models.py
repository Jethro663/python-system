from datetime import UTC, datetime

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


class TimestampMixin:
    @staticmethod
    def utcnow():
        return datetime.now(UTC)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class Role(TimestampMixin, db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)


class User(UserMixin, TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.String(50), unique=True, nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False, index=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), nullable=False, default="active")
    last_login_at = db.Column(db.DateTime, nullable=True)

    role = db.relationship("Role", backref=db.backref("users", lazy=True))

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if self.password_hash.startswith(("pbkdf2:", "scrypt:")):
            return check_password_hash(self.password_hash, password)

        return self.password_hash == password

    def to_dict(self):
        return {
            "id": self.id,
            "school_id": self.school_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "email": self.email,
            "status": self.status,
            "role": self.role.name if self.role else None,
        }


class TeacherProfile(TimestampMixin, db.Model):
    __tablename__ = "teacher_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    department = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(50), nullable=True)


class StudentProfile(TimestampMixin, db.Model):
    __tablename__ = "student_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    grade_level = db.Column(db.String(50), nullable=True)
    guardian_name = db.Column(db.String(255), nullable=True)
    guardian_contact = db.Column(db.String(100), nullable=True)


class Section(TimestampMixin, db.Model):
    __tablename__ = "sections"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    grade_level = db.Column(db.String(50), nullable=False)
    school_year = db.Column(db.String(50), nullable=False, index=True)
    adviser_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    schedule_text = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), nullable=False, default="active")


class SectionTeacher(TimestampMixin, db.Model):
    __tablename__ = "section_teachers"
    __table_args__ = (
        db.UniqueConstraint(
            "section_id",
            "teacher_user_id",
            "subject_name",
            name="uq_section_teacher_subject",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=False, index=True)
    teacher_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    subject_name = db.Column(db.String(150), nullable=False)


class Enrollment(TimestampMixin, db.Model):
    __tablename__ = "enrollments"
    __table_args__ = (
        db.UniqueConstraint("student_user_id", "section_id", name="uq_enrollment_student_section"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=False, index=True)
    status = db.Column(db.String(50), nullable=False, default="active")
    enrolled_at = db.Column(db.DateTime, default=TimestampMixin.utcnow, nullable=False)


class Module(TimestampMixin, db.Model):
    __tablename__ = "modules"

    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=False, index=True)
    teacher_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    subject_tag = db.Column(db.String(100), nullable=True)
    file_path = db.Column(db.String(500), nullable=True)
    published_at = db.Column(db.DateTime, nullable=True)


class Assignment(TimestampMixin, db.Model):
    __tablename__ = "assignments"

    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=False, index=True)
    teacher_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    instructions = db.Column(db.Text, nullable=True)
    due_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), nullable=False, default="draft")
    published_at = db.Column(db.DateTime, nullable=True)


class AssignmentQuestion(TimestampMixin, db.Model):
    __tablename__ = "assignment_questions"

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(
        db.Integer,
        db.ForeignKey("assignments.id"),
        nullable=False,
        index=True,
    )
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(50), nullable=False)
    choices_json = db.Column(db.JSON, nullable=True)
    answer_key = db.Column(db.Text, nullable=True)
    points = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    sort_order = db.Column(db.Integer, nullable=False, default=0)


class Submission(TimestampMixin, db.Model):
    __tablename__ = "submissions"
    __table_args__ = (
        db.UniqueConstraint("assignment_id", "student_user_id", name="uq_submission_assignment_student"),
    )

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(
        db.Integer,
        db.ForeignKey("assignments.id"),
        nullable=False,
        index=True,
    )
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), nullable=False, default="draft")
    response_text = db.Column(db.Text, nullable=True)
    uploaded_file_path = db.Column(db.String(500), nullable=True)
    raw_score = db.Column(db.Numeric(10, 2), nullable=True)
    final_score = db.Column(db.Numeric(10, 2), nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)


class Grade(TimestampMixin, db.Model):
    __tablename__ = "grades"
    __table_args__ = (
        db.UniqueConstraint("assignment_id", "student_user_id", name="uq_grade_assignment_student"),
    )

    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=False)
    assignment_id = db.Column(
        db.Integer,
        db.ForeignKey("assignments.id"),
        nullable=False,
        index=True,
    )
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    score = db.Column(db.Numeric(10, 2), nullable=False)
    percentage = db.Column(db.Numeric(5, 2), nullable=False)
    remarks = db.Column(db.String(100), nullable=True)


class Intervention(TimestampMixin, db.Model):
    __tablename__ = "interventions"

    id = db.Column(db.Integer, primary_key=True)
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=False)
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id"), nullable=False)
    trigger_score = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(50), nullable=False, default="open")
    teacher_note = db.Column(db.Text, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)


class Announcement(TimestampMixin, db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True)
    author_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    published_at = db.Column(db.DateTime, nullable=True)
    visibility = db.Column(db.String(50), nullable=False, default="section")


class DiscussionThread(TimestampMixin, db.Model):
    __tablename__ = "discussion_threads"

    id = db.Column(db.Integer, primary_key=True)
    author_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), nullable=False, default="draft")
    is_pinned = db.Column(db.Boolean, nullable=False, default=False)
    visibility = db.Column(db.String(50), nullable=False, default="section")
    published_at = db.Column(db.DateTime, nullable=True)


class DiscussionReply(TimestampMixin, db.Model):
    __tablename__ = "discussion_replies"

    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(
        db.Integer,
        db.ForeignKey("discussion_threads.id"),
        nullable=False,
        index=True,
    )
    author_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    body = db.Column(db.Text, nullable=False)


class CalendarEvent(TimestampMixin, db.Model):
    __tablename__ = "calendar_events"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=True)
    start_at = db.Column(db.DateTime, nullable=False)
    end_at = db.Column(db.DateTime, nullable=True)
    event_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)


class Resource(TimestampMixin, db.Model):
    __tablename__ = "resources"

    id = db.Column(db.Integer, primary_key=True)
    uploader_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    file_path = db.Column(db.String(500), nullable=False)
    visibility = db.Column(db.String(50), nullable=False, default="section")


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    action = db.Column(db.String(255), nullable=False)
    entity_type = db.Column(db.String(100), nullable=False)
    entity_id = db.Column(db.Integer, nullable=True)
    meta_json = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=TimestampMixin.utcnow, nullable=False, index=True)


class SystemSetting(TimestampMixin, db.Model):
    __tablename__ = "system_settings"

    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(100), unique=True, nullable=False)
    setting_value = db.Column(db.Text, nullable=False)
