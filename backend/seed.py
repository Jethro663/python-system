from datetime import UTC, datetime

from flask import current_app

from extensions import db
from models import (
    Announcement,
    Assignment,
    AssignmentQuestion,
    CalendarEvent,
    Enrollment,
    Module,
    Resource,
    Role,
    Section,
    SectionTeacher,
    StudentProfile,
    SystemSetting,
    TeacherProfile,
    User,
)


def seed_roles():
    for name in ("admin", "teacher", "student"):
        exists = Role.query.filter_by(name=name).first()
        if not exists:
            db.session.add(Role(name=name))

    db.session.commit()


def seed_system_settings():
    defaults = {
        "active_school_year": "2026-2027",
        "active_quarter": "Q1",
        "mastery_threshold": "74",
        "upload_limit_mb": "25",
    }

    for setting_key, setting_value in defaults.items():
        existing = SystemSetting.query.filter_by(setting_key=setting_key).first()
        if not existing:
            db.session.add(
                SystemSetting(setting_key=setting_key, setting_value=setting_value)
            )

    db.session.commit()


def seed_admin_user():
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        admin_role = Role(name="admin")
        db.session.add(admin_role)
        db.session.flush()

    email = current_app.config["DEFAULT_ADMIN_EMAIL"].strip().lower()
    password = current_app.config["DEFAULT_ADMIN_PASSWORD"]

    existing = User.query.filter_by(email=email).first()
    if existing:
        return existing

    admin_user = User(
        school_id="ADMIN-001",
        role_id=admin_role.id,
        first_name="System",
        last_name="Administrator",
        email=email,
        status="active",
        password_hash="",
    )
    admin_user.set_password(password)
    db.session.add(admin_user)
    db.session.commit()
    return admin_user


DEMO_USERS = [
    {
        "role": "teacher",
        "school_id": "TEACHER-001",
        "first_name": "Demo",
        "last_name": "Teacher",
        "email": "teacher.demo@nexora.local",
        "password": "Teacher123!",
    },
    {
        "role": "student",
        "school_id": "STUDENT-001",
        "first_name": "Demo",
        "last_name": "Student",
        "email": "student.demo@nexora.local",
        "password": "Student123!",
    },
]


def _get_or_create_user(account):
    role = Role.query.filter_by(name=account["role"]).first()
    if not role:
        role = Role(name=account["role"])
        db.session.add(role)
        db.session.flush()

    existing = User.query.filter_by(email=account["email"]).first()
    if existing:
        return existing

    user = User(
        school_id=account["school_id"],
        role_id=role.id,
        first_name=account["first_name"],
        last_name=account["last_name"],
        email=account["email"],
        status="active",
        password_hash="",
    )
    user.set_password(account["password"])
    db.session.add(user)
    db.session.flush()
    return user


def seed_demo_users():
    for account in DEMO_USERS:
        user = _get_or_create_user(account)

        if (
            account["role"] == "teacher"
            and not TeacherProfile.query.filter_by(user_id=user.id).first()
        ):
            db.session.add(
                TeacherProfile(user_id=user.id, department="General Education")
            )

        if (
            account["role"] == "student"
            and not StudentProfile.query.filter_by(user_id=user.id).first()
        ):
            db.session.add(
                StudentProfile(
                    user_id=user.id,
                    grade_level="Grade 10",
                    guardian_name="Demo Guardian",
                    guardian_contact="guardian.demo@nexora.local",
                )
            )

    db.session.commit()


def _ensure_demo_section_link(section_id, teacher_id, student_id):
    section_teacher = SectionTeacher.query.filter_by(
        section_id=section_id,
        teacher_user_id=teacher_id,
        subject_name="Mathematics",
    ).first()
    if not section_teacher:
        db.session.add(
            SectionTeacher(
                section_id=section_id,
                teacher_user_id=teacher_id,
                subject_name="Mathematics",
            )
        )

    enrollment = Enrollment.query.filter_by(
        section_id=section_id,
        student_user_id=student_id,
    ).first()
    if not enrollment:
        db.session.add(
            Enrollment(
                section_id=section_id,
                student_user_id=student_id,
                status="active",
            )
        )
    else:
        enrollment.status = "active"


def seed_demo_class():
    teacher = User.query.filter_by(email="teacher.demo@nexora.local").first()
    student = User.query.filter_by(email="student.demo@nexora.local").first()
    if not teacher or not student:
        return None

    section = Section.query.filter_by(
        name="Demo Mathematics 10",
        school_year="2026-2027",
    ).first()
    if not section:
        section = Section(
            name="Demo Mathematics 10",
            grade_level="Grade 10",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            schedule_text="Monday and Wednesday / 9:00 AM",
            status="active",
        )
        db.session.add(section)
        db.session.flush()
    else:
        section.adviser_user_id = teacher.id
        section.status = "active"

    _ensure_demo_section_link(section.id, teacher.id, student.id)

    module = Module.query.filter_by(
        section_id=section.id,
        title="Algebra Foundations",
    ).first()
    if not module:
        db.session.add(
            Module(
                section_id=section.id,
                teacher_user_id=teacher.id,
                title="Algebra Foundations",
                description="Variables, expressions, and first-step equation solving.",
                subject_tag="Mathematics",
                file_path="/demo/algebra-foundations.pdf",
                published_at=datetime.now(UTC),
            )
        )

    assignment = Assignment.query.filter_by(
        section_id=section.id,
        title="Algebra Readiness Check",
    ).first()
    if not assignment:
        assignment = Assignment(
            section_id=section.id,
            teacher_user_id=teacher.id,
            title="Algebra Readiness Check",
            type="quiz",
            instructions="Answer each item. Objective questions are graded immediately after submission.",
            status="published",
            published_at=datetime.now(UTC),
        )
        db.session.add(assignment)
        db.session.flush()

    if not AssignmentQuestion.query.filter_by(assignment_id=assignment.id).first():
        db.session.add_all(
            [
                AssignmentQuestion(
                    assignment_id=assignment.id,
                    question_text="What is 2 + 2?",
                    question_type="multiple_choice",
                    choices_json=["3", "4", "5"],
                    answer_key="4",
                    points=5,
                    sort_order=1,
                ),
                AssignmentQuestion(
                    assignment_id=assignment.id,
                    question_text="Type the word algebra.",
                    question_type="short_answer",
                    answer_key="algebra",
                    points=5,
                    sort_order=2,
                ),
            ]
        )

    if not Announcement.query.filter_by(section_id=section.id, title="Welcome to Algebra").first():
        db.session.add(
            Announcement(
                author_user_id=teacher.id,
                section_id=section.id,
                title="Welcome to Algebra",
                body="Start with the foundations module, then complete the readiness check.",
                visibility="section",
                published_at=datetime.now(UTC),
            )
        )

    if not Resource.query.filter_by(section_id=section.id, title="Formula Sheet").first():
        db.session.add(
            Resource(
                uploader_user_id=teacher.id,
                section_id=section.id,
                title="Formula Sheet",
                category="PDF",
                file_path="/demo/formula-sheet.pdf",
                visibility="section",
            )
        )

    if not CalendarEvent.query.filter_by(section_id=section.id, title="Readiness Check Window").first():
        db.session.add(
            CalendarEvent(
                section_id=section.id,
                title="Readiness Check Window",
                event_type="assessment",
                start_at=datetime.now(UTC),
                description="Complete the first class assessment from your student workspace.",
            )
        )

    db.session.commit()
    return section


def seed_defaults():
    seed_roles()
    seed_system_settings()
    seed_admin_user()
    seed_demo_users()
    seed_demo_class()
