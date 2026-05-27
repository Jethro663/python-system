import csv
from datetime import UTC, datetime
from io import StringIO
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename

from extensions import db
from models import (
    AuditLog,
    CalendarEvent,
    Enrollment,
    Grade,
    Intervention,
    Role,
    Resource,
    Section,
    SectionTeacher,
    StudentProfile,
    SystemSetting,
    TeacherProfile,
    User,
)
from services.audit import write_audit_log


admin_bp = Blueprint("admin", __name__)


def role_required(*allowed_roles):
    def decorator(view_func):
        @login_required
        def wrapped(*args, **kwargs):
            user_role = current_user.role.name if current_user.role else None
            if user_role not in allowed_roles:
                return jsonify({"message": "You do not have access to this resource."}), 403
            return view_func(*args, **kwargs)

        wrapped.__name__ = view_func.__name__
        return wrapped

    return decorator


def _ensure_role(role_name):
    role = Role.query.filter_by(name=role_name).first()
    if role:
        return role

    role = Role(name=role_name)
    db.session.add(role)
    db.session.flush()
    return role


def _attach_role_profile(user, payload):
    if user.role.name == "teacher":
        db.session.add(
            TeacherProfile(
                user_id=user.id,
                department=payload.get("department"),
                phone=payload.get("phone"),
            )
        )
    elif user.role.name == "student":
        db.session.add(
            StudentProfile(
                user_id=user.id,
                grade_level=payload.get("grade_level"),
                guardian_name=payload.get("guardian_name"),
                guardian_contact=payload.get("guardian_contact"),
            )
        )


def _get_or_create_teacher_profile(user):
    profile = TeacherProfile.query.filter_by(user_id=user.id).first()
    if profile:
        return profile

    profile = TeacherProfile(user_id=user.id)
    db.session.add(profile)
    db.session.flush()
    return profile


def _get_or_create_student_profile(user):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if profile:
        return profile

    profile = StudentProfile(user_id=user.id)
    db.session.add(profile)
    db.session.flush()
    return profile


def _update_role_profile(user, payload):
    if user.role.name == "teacher":
        profile = _get_or_create_teacher_profile(user)
        profile.department = payload.get("department")
        profile.phone = payload.get("phone")
    elif user.role.name == "student":
        profile = _get_or_create_student_profile(user)
        profile.grade_level = payload.get("grade_level")
        profile.guardian_name = payload.get("guardian_name")
        profile.guardian_contact = payload.get("guardian_contact")


def _serialize_section(section, assignments):
    return {
        "id": section.id,
        "name": section.name,
        "grade_level": section.grade_level,
        "school_year": section.school_year,
        "schedule_text": section.schedule_text,
        "status": section.status,
        "adviser_user_id": section.adviser_user_id,
        "teacher_assignments": assignments,
    }


def _serialize_assignment(assignment):
    return {
        "id": assignment.id,
        "teacher_user_id": assignment.teacher_user_id,
        "subject_name": assignment.subject_name,
    }


def _serialize_section_full(section):
    assignments = SectionTeacher.query.filter_by(section_id=section.id).order_by(
        SectionTeacher.id
    )
    return _serialize_section(section, [_serialize_assignment(item) for item in assignments])


def _serialize_profile(user):
    student_profile = StudentProfile.query.filter_by(user_id=user.id).first()
    teacher_profile = TeacherProfile.query.filter_by(user_id=user.id).first()
    return {
        "grade_level": student_profile.grade_level if student_profile else None,
        "guardian_name": student_profile.guardian_name if student_profile else None,
        "guardian_contact": student_profile.guardian_contact if student_profile else None,
        "department": teacher_profile.department if teacher_profile else None,
        "phone": teacher_profile.phone if teacher_profile else None,
    }


def _serialize_student_record(user):
    enrollments = Enrollment.query.filter_by(student_user_id=user.id).all()
    latest_grade = (
        Grade.query.filter_by(student_user_id=user.id)
        .order_by(Grade.created_at.desc())
        .first()
    )
    current_section = None
    if enrollments:
        section = db.session.get(Section, enrollments[-1].section_id)
        current_section = section.name if section else None

    return {
        **user.to_dict(),
        "current_section": current_section,
        "enrollment_count": len(enrollments),
        "latest_percentage": float(latest_grade.percentage) if latest_grade else None,
        "latest_remarks": latest_grade.remarks if latest_grade else None,
        "intervention_status": "required"
        if latest_grade and float(latest_grade.percentage) < 74
        else "clear",
    }


def _serialize_calendar_event(event):
    return {
        "id": event.id,
        "title": event.title,
        "section_id": event.section_id,
        "start_at": event.start_at.isoformat() if event.start_at else None,
        "end_at": event.end_at.isoformat() if event.end_at else None,
        "event_type": event.event_type,
        "description": event.description,
    }


def _serialize_resource(resource):
    return {
        "id": resource.id,
        "title": resource.title,
        "category": resource.category,
        "file_path": resource.file_path,
        "visibility": resource.visibility,
        "section_id": resource.section_id,
    }


def _save_uploaded_file(file_storage, destination_root):
    filename = secure_filename(file_storage.filename or "")
    if not filename:
        return None

    target_dir = Path(destination_root)
    target_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid4().hex}_{filename}"
    target_path = target_dir / unique_name
    file_storage.save(target_path)
    return str(target_path)


def _serialize_activity(entry):
    return {
        "id": entry.id,
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "created_at": entry.created_at.isoformat(),
        "meta_json": entry.meta_json,
    }


def _normalize_roster_row(row):
    return {
        "school_id": (row.get("school_id") or "").strip(),
        "first_name": (row.get("first_name") or "").strip(),
        "last_name": (row.get("last_name") or "").strip(),
        "email": (row.get("email") or "").strip().lower(),
        "grade_level": (row.get("grade_level") or "").strip(),
        "guardian_name": (row.get("guardian_name") or "").strip(),
        "guardian_contact": (row.get("guardian_contact") or "").strip(),
    }


def _validate_roster_rows(rows):
    normalized_rows = []
    validation_errors = []
    seen_school_ids = set()
    seen_emails = set()
    duplicate_rows = 0

    for index, raw_row in enumerate(rows, start=2):
        row = _normalize_roster_row(raw_row)
        missing = [
            key
            for key in ("school_id", "first_name", "last_name", "email")
            if not row[key]
        ]
        if missing:
            validation_errors.append(
                {"row_number": index, "message": f"Missing required fields: {', '.join(missing)}"}
            )
            continue

        duplicate = False
        if row["school_id"] in seen_school_ids or row["email"] in seen_emails:
            duplicate = True
            duplicate_rows += 1

        seen_school_ids.add(row["school_id"])
        seen_emails.add(row["email"])
        row["duplicate"] = duplicate
        normalized_rows.append(row)

    return normalized_rows, validation_errors, duplicate_rows


@admin_bp.get("/dashboard")
@role_required("admin")
def dashboard():
    recent_entries = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(5).all()
    return jsonify(
        {
            "totals": {
                "users": User.query.count(),
                "sections": Section.query.count(),
                "students": User.query.join(Role).filter(Role.name == "student").count(),
                "teachers": User.query.join(Role).filter(Role.name == "teacher").count(),
                "roster_records": Enrollment.query.count(),
                "pending_imports": 0,
                "active_interventions": Intervention.query.filter_by(status="open").count(),
            }
            ,
            "recent_activity": [_serialize_activity(entry) for entry in recent_entries],
        }
    )


@admin_bp.get("/users")
@role_required("admin")
def list_users():
    query = User.query.join(Role)

    role_filter = (request.args.get("role") or "").strip().lower()
    status_filter = (request.args.get("status") or "").strip().lower()
    search = (request.args.get("q") or "").strip().lower()

    if role_filter:
        query = query.filter(Role.name == role_filter)
    if status_filter:
        query = query.filter(User.status == status_filter)

    users = query.order_by(User.last_name, User.first_name).all()
    payload = []
    for user in users:
        if search:
            haystack = " ".join(
                filter(
                    None,
                    [
                        user.full_name,
                        user.email,
                        user.school_id,
                        user.role.name if user.role else None,
                        user.status,
                    ],
                )
            ).lower()
            if search not in haystack:
                continue
        item = user.to_dict()
        item.update(_serialize_profile(user))
        payload.append(item)

    return jsonify(
        {
            "users": payload,
            "filters": {
                "role": role_filter or None,
                "status": status_filter or None,
                "q": search or None,
            },
        }
    )


@admin_bp.get("/profile")
@role_required("admin")
def get_admin_profile():
    payload = current_user.to_dict()
    payload.update(_serialize_profile(current_user))
    return jsonify({"profile": payload})


@admin_bp.put("/profile")
@role_required("admin")
def update_admin_profile():
    payload = request.get_json(silent=True) or {}

    email = payload.get("email")
    if email:
        normalized_email = email.strip().lower()
        email_owner = User.query.filter(
            User.email == normalized_email,
            User.id != current_user.id,
        ).first()
        if email_owner:
            return jsonify({"message": "Email address is already in use."}), 400
        current_user.email = normalized_email

    for field in ("first_name", "last_name", "school_id"):
        if field in payload and payload[field]:
            setattr(current_user, field, payload[field])

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.profile.update",
        entity_type="user",
        entity_id=current_user.id,
        meta_json={"email": current_user.email},
    )

    profile = current_user.to_dict()
    profile.update(_serialize_profile(current_user))
    return jsonify({"profile": profile})


@admin_bp.post("/profile/password")
@role_required("admin")
def change_admin_password():
    payload = request.get_json(silent=True) or {}
    current_password = payload.get("current_password") or ""
    new_password = payload.get("new_password") or ""

    if not current_user.check_password(current_password):
        return jsonify({"message": "Current password is incorrect."}), 400

    if not new_password:
        return jsonify({"message": "New password is required."}), 400

    current_user.set_password(new_password)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.profile.change_password",
        entity_type="user",
        entity_id=current_user.id,
        meta_json={"email": current_user.email},
    )
    return jsonify({"message": "Password updated."})


@admin_bp.get("/students")
@role_required("admin")
def list_student_records():
    student_users = (
        User.query.join(Role)
        .filter(Role.name == "student")
        .order_by(User.last_name, User.first_name)
        .all()
    )
    return jsonify({"students": [_serialize_student_record(user) for user in student_users]})


@admin_bp.get("/audit")
@role_required("admin")
def list_audit_entries():
    entries = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()
    return jsonify(
        {
            "entries": [
                {
                    "id": entry.id,
                    "user_id": entry.user_id,
                    "action": entry.action,
                    "entity_type": entry.entity_type,
                    "entity_id": entry.entity_id,
                    "meta_json": entry.meta_json,
                    "created_at": entry.created_at.isoformat(),
                }
                for entry in entries
            ]
        }
    )


@admin_bp.post("/users")
@role_required("admin")
def create_user():
    payload = request.get_json(silent=True) or {}
    role_name = (payload.get("role") or "").strip().lower()
    if not role_name:
        return jsonify({"message": "Role is required."}), 400

    role = _ensure_role(role_name)
    user = User(
        school_id=payload["school_id"],
        role_id=role.id,
        first_name=payload["first_name"],
        last_name=payload["last_name"],
        email=payload["email"].strip().lower(),
        status=payload.get("status", "active"),
        password_hash="",
    )
    user.set_password(payload["password"])
    db.session.add(user)
    db.session.flush()
    _attach_role_profile(user, payload)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.user.create",
        entity_type="user",
        entity_id=user.id,
        meta_json={"email": user.email, "role": role_name},
    )

    return jsonify({"user": user.to_dict()}), 201


@admin_bp.put("/users/<int:user_id>")
@role_required("admin")
def update_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    payload = request.get_json(silent=True) or {}

    email = payload.get("email")
    if email:
        normalized_email = email.strip().lower()
        email_owner = User.query.filter(User.email == normalized_email, User.id != user.id).first()
        if email_owner:
            return jsonify({"message": "Email address is already in use."}), 400
        user.email = normalized_email

    school_id = payload.get("school_id")
    if school_id:
        existing_school_id = User.query.filter(
            User.school_id == school_id,
            User.id != user.id,
        ).first()
        if existing_school_id:
            return jsonify({"message": "School ID is already in use."}), 400
        user.school_id = school_id

    for field in ("first_name", "last_name", "status"):
        if field in payload:
            setattr(user, field, payload[field])

    _update_role_profile(user, payload)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.user.update",
        entity_type="user",
        entity_id=user.id,
        meta_json={"status": user.status, "role": user.role.name if user.role else None},
    )

    item = user.to_dict()
    item.update(_serialize_profile(user))
    return jsonify({"user": item})


@admin_bp.post("/users/<int:user_id>/status")
@role_required("admin")
def update_user_status(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    payload = request.get_json(silent=True) or {}
    status = (payload.get("status") or "").strip().lower()
    if status not in {"active", "suspended", "inactive"}:
        return jsonify({"message": "A valid status is required."}), 400

    user.status = status
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.user.status",
        entity_type="user",
        entity_id=user.id,
        meta_json={"status": status},
    )

    item = user.to_dict()
    item.update(_serialize_profile(user))
    return jsonify({"user": item})


@admin_bp.post("/users/<int:user_id>/reset-password")
@role_required("admin")
def reset_user_password(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    payload = request.get_json(silent=True) or {}
    new_password = payload.get("password") or "Password123!"
    user.set_password(new_password)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.user.reset_password",
        entity_type="user",
        entity_id=user.id,
        meta_json={"role": user.role.name if user.role else None},
    )

    return jsonify({"message": "Password reset complete."})


@admin_bp.get("/system-settings")
@role_required("admin")
def get_system_settings():
    settings = SystemSetting.query.order_by(SystemSetting.setting_key.asc()).all()
    return jsonify(
        {"settings": {item.setting_key: item.setting_value for item in settings}}
    )


@admin_bp.get("/calendar")
@role_required("admin")
def list_calendar_events():
    events = CalendarEvent.query.order_by(CalendarEvent.start_at.asc()).all()
    return jsonify({"events": [_serialize_calendar_event(event) for event in events]})


@admin_bp.get("/resources")
@role_required("admin")
def list_resources():
    resources = Resource.query.order_by(Resource.created_at.desc()).all()
    return jsonify({"resources": [_serialize_resource(resource) for resource in resources]})


@admin_bp.post("/resources")
@role_required("admin")
def create_resource():
    payload = request.get_json(silent=True) or {}
    resource = Resource(
        uploader_user_id=current_user.id,
        section_id=payload.get("section_id"),
        title=payload["title"],
        category=payload.get("category"),
        file_path=payload["file_path"],
        visibility=payload.get("visibility", "school"),
    )
    db.session.add(resource)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.resource.create",
        entity_type="resource",
        entity_id=resource.id,
        meta_json={"title": resource.title, "visibility": resource.visibility},
    )
    return jsonify({"resource": _serialize_resource(resource)}), 201


@admin_bp.put("/resources/<int:resource_id>")
@role_required("admin")
def update_resource(resource_id):
    resource = db.session.get(Resource, resource_id)
    if not resource:
        return jsonify({"message": "Resource not found."}), 404

    payload = request.get_json(silent=True) or {}
    for field in ("title", "category", "file_path", "visibility", "section_id"):
        if field in payload:
            setattr(resource, field, payload[field])

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.resource.update",
        entity_type="resource",
        entity_id=resource.id,
        meta_json={"title": resource.title, "visibility": resource.visibility},
    )
    return jsonify({"resource": _serialize_resource(resource)})


@admin_bp.post("/uploads")
@role_required("admin")
def upload_admin_file():
    file = request.files.get("file")
    if not file:
        return jsonify({"message": "File upload is required."}), 400

    kind = (request.form.get("kind") or "resource").strip().lower()
    if kind not in {"resource"}:
        return jsonify({"message": "Unsupported upload type."}), 400

    destination_root = current_app.config["RESOURCE_UPLOAD_DIR"]
    saved_path = _save_uploaded_file(file, destination_root)
    if not saved_path:
        return jsonify({"message": "Uploaded file must have a valid filename."}), 400

    relative_path = Path(saved_path)
    try:
        relative_path = relative_path.relative_to(Path(current_app.config["UPLOAD_ROOT"]))
        serialized_path = relative_path.as_posix()
    except ValueError:
        serialized_path = str(relative_path)

    write_audit_log(
        user_id=current_user.id,
        action="admin.upload.create",
        entity_type="resource_upload",
        meta_json={"kind": kind, "file_path": serialized_path},
    )
    return jsonify({"file_path": serialized_path}), 201


@admin_bp.post("/calendar")
@role_required("admin")
def create_calendar_event():
    payload = request.get_json(silent=True) or {}
    event = CalendarEvent(
        title=payload["title"],
        section_id=payload.get("section_id"),
        start_at=datetime.fromisoformat(payload["start_at"]),
        end_at=datetime.fromisoformat(payload["end_at"])
        if payload.get("end_at")
        else None,
        event_type=payload["event_type"],
        description=payload.get("description"),
    )
    db.session.add(event)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.calendar.create",
        entity_type="calendar_event",
        entity_id=event.id,
        meta_json={"title": event.title, "event_type": event.event_type},
    )
    return jsonify({"event": _serialize_calendar_event(event)}), 201


@admin_bp.put("/calendar/<int:event_id>")
@role_required("admin")
def update_calendar_event(event_id):
    event = db.session.get(CalendarEvent, event_id)
    if not event:
        return jsonify({"message": "Calendar event not found."}), 404

    payload = request.get_json(silent=True) or {}
    for field in ("title", "section_id", "event_type", "description"):
        if field in payload:
            setattr(event, field, payload[field])
    if "start_at" in payload:
        event.start_at = datetime.fromisoformat(payload["start_at"])
    if "end_at" in payload:
        event.end_at = datetime.fromisoformat(payload["end_at"]) if payload.get("end_at") else None

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.calendar.update",
        entity_type="calendar_event",
        entity_id=event.id,
        meta_json={"title": event.title, "event_type": event.event_type},
    )
    return jsonify({"event": _serialize_calendar_event(event)})


@admin_bp.put("/system-settings")
@role_required("admin")
def update_system_settings():
    payload = request.get_json(silent=True) or {}
    for setting_key, setting_value in payload.items():
        setting = SystemSetting.query.filter_by(setting_key=setting_key).first()
        if not setting:
            setting = SystemSetting(setting_key=setting_key, setting_value=str(setting_value))
            db.session.add(setting)
        else:
            setting.setting_value = str(setting_value)

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.settings.update",
        entity_type="system_setting",
        meta_json=payload,
    )
    settings = SystemSetting.query.order_by(SystemSetting.setting_key.asc()).all()
    return jsonify(
        {"settings": {item.setting_key: item.setting_value for item in settings}}
    )


@admin_bp.post("/academic-transition")
@role_required("admin")
def run_academic_transition():
    payload = request.get_json(silent=True) or {}
    next_quarter = payload.get("next_quarter")
    next_school_year = payload.get("next_school_year")

    if not next_quarter:
        return jsonify({"message": "Next quarter is required."}), 400

    previous_quarter = SystemSetting.query.filter_by(setting_key="active_quarter").first()
    previous_school_year = SystemSetting.query.filter_by(setting_key="active_school_year").first()

    archived_quarter = previous_quarter.setting_value if previous_quarter else None
    archived_school_year = previous_school_year.setting_value if previous_school_year else None

    if not previous_quarter:
        previous_quarter = SystemSetting(setting_key="active_quarter", setting_value=str(next_quarter))
        db.session.add(previous_quarter)
    else:
        previous_quarter.setting_value = str(next_quarter)

    if next_school_year:
        if not previous_school_year:
            previous_school_year = SystemSetting(
                setting_key="active_school_year",
                setting_value=str(next_school_year),
            )
            db.session.add(previous_school_year)
        else:
            previous_school_year.setting_value = str(next_school_year)

    open_interventions = Intervention.query.filter_by(status="open").all()
    reset_count = 0
    for intervention in open_interventions:
        intervention.status = "closed"
        intervention.resolved_at = datetime.now(UTC)
        reset_count += 1

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.academic.transition",
        entity_type="system_setting",
        meta_json={
            "from_quarter": archived_quarter,
            "to_quarter": next_quarter,
            "from_school_year": archived_school_year,
            "to_school_year": next_school_year or archived_school_year,
            "reset_interventions": reset_count,
        },
    )

    settings = SystemSetting.query.order_by(SystemSetting.setting_key.asc()).all()
    return jsonify(
        {
            "settings": {item.setting_key: item.setting_value for item in settings},
            "summary": {
                "archived_quarter": archived_quarter,
                "archived_school_year": archived_school_year,
                "reset_interventions": reset_count,
            },
        }
    )


@admin_bp.get("/sections")
@role_required("admin")
def list_sections():
    sections = Section.query.order_by(Section.school_year.desc(), Section.name.asc()).all()
    return jsonify({"sections": [_serialize_section_full(section) for section in sections]})


@admin_bp.get("/reports")
@role_required("admin")
def admin_reports_summary():
    total_enrollments = Enrollment.query.count()
    section_count = Section.query.count()
    user_count = User.query.count()
    at_risk_grades = Grade.query.filter(Grade.percentage < 74).count()
    grade_snapshots = (
        Grade.query.order_by(Grade.created_at.desc()).limit(20).all()
    )

    return jsonify(
        {
            "summary": {
                "total_enrollments": total_enrollments,
                "section_count": section_count,
                "user_count": user_count,
                "at_risk_grades": at_risk_grades,
            },
            "grade_snapshots": [
                {
                    "section_id": grade.section_id,
                    "assignment_id": grade.assignment_id,
                    "student_user_id": grade.student_user_id,
                    "score": float(grade.score),
                    "percentage": float(grade.percentage),
                    "remarks": grade.remarks,
                }
                for grade in grade_snapshots
            ],
        }
    )


@admin_bp.post("/sections")
@role_required("admin")
def create_section():
    payload = request.get_json(silent=True) or {}
    section = Section(
        name=payload["name"],
        grade_level=payload["grade_level"],
        school_year=payload["school_year"],
        adviser_user_id=payload.get("adviser_user_id"),
        schedule_text=payload.get("schedule_text"),
        status=payload.get("status", "active"),
    )
    db.session.add(section)
    db.session.flush()

    assignments = []
    for item in payload.get("teacher_assignments", []):
        assignment = SectionTeacher(
            section_id=section.id,
            teacher_user_id=item["teacher_user_id"],
            subject_name=item["subject_name"],
        )
        db.session.add(assignment)
        assignments.append(
            {
                "teacher_user_id": assignment.teacher_user_id,
                "subject_name": assignment.subject_name,
            }
        )

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.section.create",
        entity_type="section",
        entity_id=section.id,
        meta_json={"name": section.name, "school_year": section.school_year},
    )
    return jsonify({"section": _serialize_section(section, assignments)}), 201


@admin_bp.put("/sections/<int:section_id>")
@role_required("admin")
def update_section(section_id):
    section = db.session.get(Section, section_id)
    if not section:
        return jsonify({"message": "Section not found."}), 404

    payload = request.get_json(silent=True) or {}
    for field in ("name", "grade_level", "school_year", "schedule_text", "status", "adviser_user_id"):
        if field in payload:
            setattr(section, field, payload[field])

    if "teacher_assignments" in payload:
        SectionTeacher.query.filter_by(section_id=section.id).delete()
        for item in payload.get("teacher_assignments", []):
            db.session.add(
                SectionTeacher(
                    section_id=section.id,
                    teacher_user_id=item["teacher_user_id"],
                    subject_name=item["subject_name"],
                )
            )

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.section.update",
        entity_type="section",
        entity_id=section.id,
        meta_json={"status": section.status, "name": section.name},
    )
    return jsonify({"section": _serialize_section_full(section)})


@admin_bp.post("/rosters/preview")
@role_required("admin")
def preview_roster_import():
    file = request.files.get("file")
    if not file:
        return jsonify({"message": "CSV file is required."}), 400

    content = file.read().decode("utf-8")
    reader = csv.DictReader(StringIO(content))
    rows, validation_errors, duplicate_rows = _validate_roster_rows(list(reader))
    valid_rows = sum(1 for row in rows if not row["duplicate"])

    return jsonify(
        {
            "rows": rows,
            "validation_errors": validation_errors,
            "summary": {
                "total_rows": len(rows),
                "valid_rows": valid_rows,
                "duplicate_rows": duplicate_rows,
                "error_rows": len(validation_errors),
            },
        }
    )


@admin_bp.post("/rosters/import")
@role_required("admin")
def import_roster():
    payload = request.get_json(silent=True) or {}
    section_id = payload.get("section_id")
    rows = payload.get("rows") or []

    section = db.session.get(Section, section_id)
    if not section:
        return jsonify({"message": "Section not found."}), 404

    student_role = _ensure_role("student")
    created_users = 0
    created_enrollments = 0

    for row in rows:
        if row.get("duplicate"):
            continue

        user = User.query.filter(
            (User.school_id == row["school_id"]) | (User.email == row["email"])
        ).first()
        if not user:
            user = User(
                school_id=row["school_id"],
                role_id=student_role.id,
                first_name=row["first_name"],
                last_name=row["last_name"],
                email=row["email"],
                status="active",
                password_hash="",
            )
            user.set_password("Student123!")
            db.session.add(user)
            db.session.flush()
            db.session.add(
                StudentProfile(
                    user_id=user.id,
                    grade_level=row.get("grade_level"),
                    guardian_name=row.get("guardian_name"),
                    guardian_contact=row.get("guardian_contact"),
                )
            )
            created_users += 1

        enrollment = Enrollment.query.filter_by(
            section_id=section.id,
            student_user_id=user.id,
        ).first()
        if not enrollment:
            db.session.add(
                Enrollment(
                    section_id=section.id,
                    student_user_id=user.id,
                    status="active",
                )
            )
            created_enrollments += 1

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="admin.roster.import",
        entity_type="section",
        entity_id=section.id,
        meta_json={
            "created_users": created_users,
            "created_enrollments": created_enrollments,
        },
    )

    return (
        jsonify(
            {
                "summary": {
                    "created_users": created_users,
                    "created_enrollments": created_enrollments,
                }
            }
        ),
        201,
    )
