from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import csv
import io
import json

from flask import Blueprint, Response, current_app, jsonify, request
from flask_login import current_user
from werkzeug.utils import secure_filename

from extensions import db
from models import (
    Announcement,
    Assignment,
    AssignmentQuestion,
    CalendarEvent,
    DiscussionReply,
    DiscussionThread,
    Enrollment,
    Grade,
    Intervention,
    Module,
    Resource,
    Section,
    SectionTeacher,
    StudentProfile,
    Submission,
    TeacherProfile,
    User,
)
from routes.admin import role_required
from services.audit import write_audit_log


teacher_bp = Blueprint("teacher", __name__)


def _teacher_section_query():
    return SectionTeacher.query.filter_by(teacher_user_id=current_user.id)


def _teacher_section_ids():
    return [item.section_id for item in _teacher_section_query().all()]


def _teacher_subjects_by_section():
    mapping = {}
    for item in _teacher_section_query().all():
        mapping.setdefault(item.section_id, []).append(item.subject_name)
    return mapping


def _teacher_sections():
    section_ids = _teacher_section_ids()
    return (
        Section.query.filter(Section.id.in_(section_ids)).order_by(Section.name.asc()).all()
        if section_ids
        else []
    )


def _serialize_section_card(section, subjects):
    student_count = Enrollment.query.filter_by(section_id=section.id, status="active").count()
    upcoming_events = (
        CalendarEvent.query.filter_by(section_id=section.id)
        .order_by(CalendarEvent.start_at.asc())
        .limit(3)
        .all()
    )
    at_risk_count = (
        Intervention.query.filter_by(section_id=section.id, status="open").count()
    )
    return {
        "id": section.id,
        "name": section.name,
        "grade_level": section.grade_level,
        "school_year": section.school_year,
        "schedule_text": section.schedule_text,
        "status": section.status,
        "subjects": subjects,
        "student_count": student_count,
        "upcoming_events": [
            {
                "id": event.id,
                "title": event.title,
                "start_at": event.start_at.isoformat() if event.start_at else None,
                "event_type": event.event_type,
            }
            for event in upcoming_events
        ],
        "at_risk_students": at_risk_count,
    }


def _serialize_module(module):
    return {
        "id": module.id,
        "title": module.title,
        "description": module.description,
        "subject_tag": module.subject_tag,
        "file_path": module.file_path,
        "status": "published" if module.published_at else "draft",
        "published_at": module.published_at.isoformat() if module.published_at else None,
    }


def _serialize_assignment(assignment):
    return {
        "id": assignment.id,
        "section_id": assignment.section_id,
        "title": assignment.title,
        "type": assignment.type,
        "instructions": assignment.instructions,
        "status": assignment.status,
        "due_at": assignment.due_at.isoformat() if assignment.due_at else None,
        "published_at": assignment.published_at.isoformat() if assignment.published_at else None,
    }


def _serialize_assignment_question(question):
    return {
        "id": question.id,
        "assignment_id": question.assignment_id,
        "question_text": question.question_text,
        "question_type": question.question_type,
        "choices_json": question.choices_json or [],
        "answer_key": question.answer_key,
        "points": float(question.points),
        "sort_order": question.sort_order,
    }


def _parse_submission_response_payload(submission):
    if not submission or not submission.response_text:
        return None

    try:
        payload = json.loads(submission.response_text)
    except (TypeError, ValueError):
        return None

    if isinstance(payload, dict) and payload.get("kind") == "question_responses":
        return payload

    return None


def _answer_to_text(value):
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    if value is None:
        return ""
    return str(value)


def _submission_response_summary(response_payload):
    if not response_payload:
        return None
    if response_payload.get("summary"):
        return response_payload["summary"]

    lines = []
    for response in response_payload.get("responses", []):
        if not isinstance(response, dict):
            continue
        question_text = response.get("question_text") or f"Question {response.get('question_id')}"
        lines.append(f"{question_text}: {_answer_to_text(response.get('answer'))}")

    return "\n".join(lines) if lines else None


def _serialize_submission(submission):
    student = db.session.get(User, submission.student_user_id)
    assignment = db.session.get(Assignment, submission.assignment_id)
    response_payload = _parse_submission_response_payload(submission)
    return {
        "id": submission.id,
        "assignment_id": submission.assignment_id,
        "assignment_title": assignment.title if assignment else None,
        "student_user_id": submission.student_user_id,
        "student_name": student.full_name if student else None,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "status": submission.status,
        "response_text": _submission_response_summary(response_payload)
        if response_payload
        else submission.response_text,
        "response_payload": response_payload,
        "responses": response_payload.get("responses", []) if response_payload else [],
        "uploaded_file_path": submission.uploaded_file_path,
        "raw_score": float(submission.raw_score) if submission.raw_score is not None else None,
        "final_score": float(submission.final_score) if submission.final_score is not None else None,
        "feedback": submission.feedback,
        "graded_at": submission.graded_at.isoformat() if submission.graded_at else None,
    }


def _serialize_student(user):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    latest_intervention = (
        Intervention.query.filter_by(student_user_id=user.id)
        .order_by(Intervention.created_at.desc())
        .first()
    )
    return {
        "id": user.id,
        "school_id": user.school_id,
        "full_name": user.full_name,
        "email": user.email,
        "status": user.status,
        "grade_level": profile.grade_level if profile else None,
        "guardian_name": profile.guardian_name if profile else None,
        "intervention_status": latest_intervention.status if latest_intervention else "clear",
        "intervention_note": latest_intervention.teacher_note if latest_intervention else None,
    }


def _serialize_resource(resource):
    return {
        "id": resource.id,
        "title": resource.title,
        "category": resource.category,
        "file_path": resource.file_path,
        "visibility": resource.visibility,
    }


def _serialize_event(event):
    return {
        "id": event.id,
        "title": event.title,
        "event_type": event.event_type,
        "start_at": event.start_at.isoformat() if event.start_at else None,
        "end_at": event.end_at.isoformat() if event.end_at else None,
        "description": event.description,
    }


def _serialize_announcement(announcement):
    return {
        "id": announcement.id,
        "title": announcement.title,
        "body": announcement.body,
        "visibility": announcement.visibility,
        "status": "published" if announcement.published_at else "draft",
        "published_at": announcement.published_at.isoformat() if announcement.published_at else None,
    }


def _serialize_discussion_reply(reply):
    author = db.session.get(User, reply.author_user_id)
    return {
        "id": reply.id,
        "author_user_id": reply.author_user_id,
        "author_name": author.full_name if author else None,
        "body": reply.body,
        "created_at": reply.created_at.isoformat() if reply.created_at else None,
    }


def _serialize_discussion_thread(thread):
    author = db.session.get(User, thread.author_user_id)
    replies = (
        DiscussionReply.query.filter_by(thread_id=thread.id)
        .order_by(DiscussionReply.created_at.asc())
        .all()
    )
    return {
        "id": thread.id,
        "title": thread.title,
        "body": thread.body,
        "status": thread.status,
        "is_pinned": thread.is_pinned,
        "author_user_id": thread.author_user_id,
        "author_name": author.full_name if author else None,
        "published_at": thread.published_at.isoformat() if thread.published_at else None,
        "replies": [_serialize_discussion_reply(reply) for reply in replies],
    }


def _announcement_status_to_published_at(status):
    normalized = (status or "draft").strip().lower()
    if normalized == "published":
        return datetime.now(UTC)
    return None


def _parse_optional_datetime(value):
    if not value:
        return None
    if value == "now":
        return datetime.now(UTC)
    return datetime.fromisoformat(value)


def _normalize_status(value, default="draft"):
    return (value or default).strip().lower()


def _serialize_section_option(section):
    return {
        "id": section.id,
        "name": section.name,
        "grade_level": section.grade_level,
        "school_year": section.school_year,
        "schedule_text": section.schedule_text,
    }


def _serialize_roster_entry(user, section_id):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    latest_grade = (
        Grade.query.filter_by(student_user_id=user.id, section_id=section_id)
        .order_by(Grade.created_at.desc())
        .first()
    )
    intervention = (
        Intervention.query.filter_by(student_user_id=user.id, section_id=section_id)
        .order_by(Intervention.created_at.desc())
        .first()
    )
    return {
        "id": user.id,
        "school_id": user.school_id,
        "full_name": user.full_name,
        "email": user.email,
        "status": user.status,
        "grade_level": profile.grade_level if profile else None,
        "guardian_name": profile.guardian_name if profile else None,
        "latest_percentage": float(latest_grade.percentage) if latest_grade else None,
        "latest_remarks": latest_grade.remarks if latest_grade else None,
        "intervention_status": intervention.status if intervention else "clear",
        "teacher_note": intervention.teacher_note if intervention else None,
    }


def _build_teacher_performance_payload():
    section_ids = _teacher_section_ids()
    sections = _teacher_sections()
    grades = Grade.query.filter(Grade.section_id.in_(section_ids)).all() if section_ids else []
    assignments = (
        Assignment.query.filter(Assignment.section_id.in_(section_ids)).order_by(Assignment.created_at.desc()).all()
        if section_ids
        else []
    )

    assignment_trends = []
    for assignment in assignments:
        assignment_grades = [grade for grade in grades if grade.assignment_id == assignment.id]
        percentages = [float(grade.percentage) for grade in assignment_grades]
        assignment_trends.append(
            {
                "assignment_id": assignment.id,
                "assignment_title": assignment.title,
                "section_id": assignment.section_id,
                "section_name": db.session.get(Section, assignment.section_id).name
                if db.session.get(Section, assignment.section_id)
                else None,
                "submission_count": len(assignment_grades),
                "average_percentage": round(sum(percentages) / len(percentages), 2)
                if percentages
                else None,
                "published_at": assignment.published_at.isoformat() if assignment.published_at else None,
            }
        )

    low_scorers = []
    seen_pairs = set()
    for grade in grades:
        percentage = float(grade.percentage)
        if percentage >= 74:
            continue
        key = (grade.section_id, grade.student_user_id)
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        user = db.session.get(User, grade.student_user_id)
        section = db.session.get(Section, grade.section_id)
        low_scorers.append(
            {
                "student_user_id": grade.student_user_id,
                "student_name": user.full_name if user else None,
                "section_id": grade.section_id,
                "section_name": section.name if section else None,
                "percentage": percentage,
                "remarks": grade.remarks,
            }
        )

    section_summaries = []
    for section in sections:
        section_grades = [float(grade.percentage) for grade in grades if grade.section_id == section.id]
        section_summaries.append(
            {
                "section_id": section.id,
                "section_name": section.name,
                "student_count": Enrollment.query.filter_by(section_id=section.id, status="active").count(),
                "assignment_count": len([assignment for assignment in assignments if assignment.section_id == section.id]),
                "class_average": round(sum(section_grades) / len(section_grades), 2)
                if section_grades
                else None,
                "at_risk_count": len([grade for grade in grades if grade.section_id == section.id and float(grade.percentage) < 74]),
                "schedule_text": section.schedule_text,
            }
        )

    return {
        "summary": {
            "classes": len(sections),
            "tracked_assignments": len(assignments),
            "low_scorers": len(low_scorers),
            "overall_average": round(sum(float(grade.percentage) for grade in grades) / len(grades), 2)
            if grades
            else None,
        },
        "section_summaries": section_summaries,
        "assignment_trends": assignment_trends,
        "low_scorers": low_scorers,
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


def _teacher_section_or_404(section_id):
    section = db.session.get(Section, section_id)
    if not section:
        return None, (jsonify({"message": "Section not found."}), 404)

    assignment = SectionTeacher.query.filter_by(
        section_id=section_id,
        teacher_user_id=current_user.id,
    ).first()
    if not assignment:
        return None, (jsonify({"message": "You do not have access to this class."}), 403)

    return section, None


def _get_or_create_teacher_profile(user):
    profile = TeacherProfile.query.filter_by(user_id=user.id).first()
    if profile:
        return profile

    profile = TeacherProfile(user_id=user.id)
    db.session.add(profile)
    db.session.flush()
    return profile


def _serialize_teacher_profile(user):
    profile = TeacherProfile.query.filter_by(user_id=user.id).first()
    return {
        "id": user.id,
        "school_id": user.school_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.full_name,
        "email": user.email,
        "status": user.status,
        "department": profile.department if profile else None,
        "phone": profile.phone if profile else None,
    }


def _build_teacher_reports_payload():
    section_ids = _teacher_section_ids()
    sections = (
        Section.query.filter(Section.id.in_(section_ids)).order_by(Section.name.asc()).all()
        if section_ids
        else []
    )
    assignments = (
        Assignment.query.filter(Assignment.section_id.in_(section_ids)).all()
        if section_ids
        else []
    )
    modules = (
        Module.query.filter(Module.section_id.in_(section_ids)).all()
        if section_ids
        else []
    )
    interventions = (
        Intervention.query.filter(Intervention.section_id.in_(section_ids)).all()
        if section_ids
        else []
    )
    submissions = (
        Submission.query.join(Assignment, Submission.assignment_id == Assignment.id)
        .filter(Assignment.section_id.in_(section_ids))
        .all()
        if section_ids
        else []
    )
    grades = Grade.query.filter(Grade.section_id.in_(section_ids)).all() if section_ids else []
    section_filter = request.args.get("section_id", type=int)
    assignment_filter = request.args.get("assignment_id", type=int)
    status_filter = (request.args.get("submission_status") or "").strip().lower()
    student_query = (request.args.get("student_query") or "").strip().lower()
    score_band = (request.args.get("score_band") or "").strip().lower()
    min_percentage = request.args.get("min_percentage", type=float)
    max_percentage = request.args.get("max_percentage", type=float)

    if section_filter:
        sections = [section for section in sections if section.id == section_filter]
        section_ids = [section.id for section in sections]
        assignments = [assignment for assignment in assignments if assignment.section_id in section_ids]
        modules = [module for module in modules if module.section_id in section_ids]
        interventions = [item for item in interventions if item.section_id in section_ids]
        submissions = [submission for submission in submissions if db.session.get(Assignment, submission.assignment_id).section_id in section_ids]
        grades = [grade for grade in grades if grade.section_id in section_ids]

    if assignment_filter:
        assignments = [assignment for assignment in assignments if assignment.id == assignment_filter]
        assignment_ids = {assignment.id for assignment in assignments}
        submissions = [submission for submission in submissions if submission.assignment_id in assignment_ids]
        grades = [grade for grade in grades if grade.assignment_id in assignment_ids]
        interventions = [item for item in interventions if item.assignment_id in assignment_ids]

    def matches_student_query(user_id):
        if not student_query:
            return True
        user = db.session.get(User, user_id)
        if not user:
            return False
        haystack = " ".join((user.full_name, user.school_id or "", user.email or "")).lower()
        return student_query in haystack

    if status_filter:
        submissions = [submission for submission in submissions if submission.status == status_filter]

    submissions = [submission for submission in submissions if matches_student_query(submission.student_user_id)]
    interventions = [item for item in interventions if matches_student_query(item.student_user_id)]
    grades = [grade for grade in grades if matches_student_query(grade.student_user_id)]

    if score_band:
        def in_score_band(percentage):
            value = float(percentage)
            if score_band == "at_risk":
                return value < 74
            if score_band == "passing":
                return value >= 74
            if score_band == "high":
                return value >= 90
            return True

        grades = [grade for grade in grades if in_score_band(grade.percentage)]

    if min_percentage is not None:
        grades = [grade for grade in grades if float(grade.percentage) >= min_percentage]
        submissions = [
            submission
            for submission in submissions
            if submission.final_score is None or float(submission.final_score) >= min_percentage
        ]

    if max_percentage is not None:
        grades = [grade for grade in grades if float(grade.percentage) <= max_percentage]
        submissions = [
            submission
            for submission in submissions
            if submission.final_score is None or float(submission.final_score) <= max_percentage
        ]

    return {
        "filters": {
            "section_id": section_filter,
            "assignment_id": assignment_filter,
            "submission_status": status_filter or None,
            "student_query": student_query or None,
            "score_band": score_band or None,
            "min_percentage": min_percentage,
            "max_percentage": max_percentage,
        },
        "sections": [_serialize_section_option(section) for section in sections],
        "assignments": [_serialize_assignment(assignment) for assignment in assignments],
        "summary": {
            "classes": len(set(section_ids)),
            "modules": len(modules),
            "assignments": len(assignments),
            "submissions": len(submissions),
            "published_assignments": len(
                [assignment for assignment in assignments if assignment.status == "published"]
            ),
            "open_interventions": len(
                [intervention for intervention in interventions if intervention.status == "open"]
            ),
        },
        "class_records": [
            {
                "section_id": section.id,
                "section_name": section.name,
                "students": [
                    {
                        "student_user_id": user.id,
                        "student_name": user.full_name,
                        "grade_level": (
                            StudentProfile.query.filter_by(user_id=user.id).first().grade_level
                            if StudentProfile.query.filter_by(user_id=user.id).first()
                            else None
                        ),
                        "grades": [
                            {
                                "assignment_id": grade.assignment_id,
                                "score": float(grade.score),
                                "percentage": float(grade.percentage),
                                "remarks": grade.remarks,
                            }
                            for grade in grades
                            if grade.section_id == section.id and grade.student_user_id == user.id
                        ],
                    }
                    for user in [
                        db.session.get(User, enrollment.student_user_id)
                        for enrollment in Enrollment.query.filter_by(
                            section_id=section.id,
                            status="active",
                        ).all()
                    ]
                    if user and matches_student_query(user.id)
                ],
            }
            for section in sections
        ],
        "submission_summaries": [_serialize_submission(submission) for submission in submissions],
        "intervention_list": [
            {
                "id": intervention.id,
                "section_id": intervention.section_id,
                "student_user_id": intervention.student_user_id,
                "student_name": (
                    db.session.get(User, intervention.student_user_id).full_name
                    if db.session.get(User, intervention.student_user_id)
                    else None
                ),
                "section_name": (
                    db.session.get(Section, intervention.section_id).name
                    if db.session.get(Section, intervention.section_id)
                    else None
                ),
                "status": intervention.status,
                "trigger_score": float(intervention.trigger_score),
                "teacher_note": intervention.teacher_note,
            }
            for intervention in interventions
        ],
    }


@teacher_bp.get("/dashboard")
@role_required("teacher")
def teacher_dashboard():
    section_ids = _teacher_section_ids()
    subjects_by_section = _teacher_subjects_by_section()

    sections = (
        Section.query.filter(Section.id.in_(section_ids)).order_by(Section.name.asc()).all()
        if section_ids
        else []
    )

    enrolled_students = (
        Enrollment.query.filter(Enrollment.section_id.in_(section_ids)).count()
        if section_ids
        else 0
    )
    draft_assignments = Assignment.query.filter_by(
        teacher_user_id=current_user.id, status="draft"
    ).count()
    pending_submissions = (
        Submission.query.join(Assignment, Submission.assignment_id == Assignment.id)
        .filter(
            Assignment.section_id.in_(section_ids),
            Submission.status == "submitted",
        )
        .count()
        if section_ids
        else 0
    )
    at_risk_students = (
        Intervention.query.filter(
            Intervention.section_id.in_(section_ids),
            Intervention.status == "open",
        ).count()
        if section_ids
        else 0
    )
    upcoming_events = (
        CalendarEvent.query.filter(CalendarEvent.section_id.in_(section_ids))
        .order_by(CalendarEvent.start_at.asc())
        .count()
        if section_ids
        else 0
    )

    return jsonify(
        {
            "summary": {
                "assigned_sections": len(sections),
                "enrolled_students": enrolled_students,
                "draft_assignments": draft_assignments,
                "pending_submissions": pending_submissions,
                "at_risk_students": at_risk_students,
                "upcoming_events": upcoming_events,
            },
            "sections": [
                _serialize_section_card(section, subjects_by_section.get(section.id, []))
                for section in sections
            ],
        }
    )


@teacher_bp.get("/profile")
@role_required("teacher")
def teacher_profile():
    return jsonify({"profile": _serialize_teacher_profile(current_user)})


@teacher_bp.put("/profile")
@role_required("teacher")
def update_teacher_profile():
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

    profile = _get_or_create_teacher_profile(current_user)
    profile.department = payload.get("department")
    profile.phone = payload.get("phone")

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.profile.update",
        entity_type="user",
        entity_id=current_user.id,
        meta_json={"email": current_user.email},
    )
    return jsonify({"profile": _serialize_teacher_profile(current_user)})


@teacher_bp.post("/profile/password")
@role_required("teacher")
def change_teacher_password():
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
        action="teacher.profile.change_password",
        entity_type="user",
        entity_id=current_user.id,
        meta_json={"email": current_user.email},
    )
    return jsonify({"message": "Password updated."})


@teacher_bp.get("/classes")
@role_required("teacher")
def list_teacher_classes():
    subjects_by_section = _teacher_subjects_by_section()
    sections = _teacher_sections()
    return jsonify(
        {
            "classes": [
                _serialize_section_card(section, subjects_by_section.get(section.id, []))
                for section in sections
            ]
        }
    )


@teacher_bp.get("/roster")
@role_required("teacher")
def teacher_roster():
    sections = _teacher_sections()
    payload = []
    for section in sections:
        enrollments = Enrollment.query.filter_by(section_id=section.id, status="active").all()
        students = [
            _serialize_roster_entry(user, section.id)
            for user in [db.session.get(User, enrollment.student_user_id) for enrollment in enrollments]
            if user
        ]
        payload.append(
            {
                "section": _serialize_section_option(section),
                "students": students,
            }
        )

    return jsonify({"sections": payload})


@teacher_bp.get("/classes/<int:section_id>/roster")
@role_required("teacher")
def teacher_class_roster(section_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    enrolled_ids = {
        enrollment.student_user_id
        for enrollment in Enrollment.query.filter_by(section_id=section.id, status="active").all()
    }
    students = [
        _serialize_roster_entry(db.session.get(User, student_id), section.id)
        for student_id in enrolled_ids
        if db.session.get(User, student_id)
    ]
    eligible_students = []
    for student in User.query.join(StudentProfile, StudentProfile.user_id == User.id).all():
        if student.role and student.role.name == "student" and student.id not in enrolled_ids:
            eligible_students.append(
                {
                    "id": student.id,
                    "school_id": student.school_id,
                    "full_name": student.full_name,
                    "grade_level": StudentProfile.query.filter_by(user_id=student.id).first().grade_level
                    if StudentProfile.query.filter_by(user_id=student.id).first()
                    else None,
                }
            )

    return jsonify(
        {
            "section": _serialize_section_option(section),
            "students": students,
            "eligible_students": eligible_students,
        }
    )


@teacher_bp.post("/classes/<int:section_id>/roster")
@role_required("teacher")
def add_teacher_roster_student(section_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    student_user_id = payload.get("student_user_id")
    if not student_user_id:
        return jsonify({"message": "student_user_id is required."}), 400

    student = db.session.get(User, int(student_user_id))
    if not student or not student.role or student.role.name != "student":
        return jsonify({"message": "Eligible student not found."}), 404

    existing = Enrollment.query.filter_by(
        section_id=section.id,
        student_user_id=student.id,
    ).first()
    if existing:
        existing.status = "active"
        enrollment = existing
    else:
        enrollment = Enrollment(
            section_id=section.id,
            student_user_id=student.id,
            status="active",
        )
        db.session.add(enrollment)

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.roster.add_student",
        entity_type="enrollment",
        entity_id=enrollment.id,
        meta_json={"section_id": section.id, "student_user_id": student.id},
    )
    return jsonify({"student": _serialize_roster_entry(student, section.id)}), 201


@teacher_bp.get("/calendar")
@role_required("teacher")
def teacher_calendar():
    sections = _teacher_sections()
    section_ids = [section.id for section in sections]
    events = (
        CalendarEvent.query.filter(CalendarEvent.section_id.in_(section_ids))
        .order_by(CalendarEvent.start_at.asc())
        .all()
        if section_ids
        else []
    )
    return jsonify(
        {
            "sections": [_serialize_section_option(section) for section in sections],
            "events": [_serialize_event(event) for event in events],
        }
    )


@teacher_bp.post("/calendar")
@role_required("teacher")
def create_teacher_calendar_event():
    payload = request.get_json(silent=True) or {}
    section_id = int(payload.get("section_id"))
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    event = CalendarEvent(
        title=payload["title"],
        section_id=section.id,
        start_at=datetime.fromisoformat(payload["start_at"]),
        end_at=datetime.fromisoformat(payload["end_at"]) if payload.get("end_at") else None,
        event_type=payload["event_type"],
        description=payload.get("description"),
    )
    db.session.add(event)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.calendar.create",
        entity_type="calendar_event",
        entity_id=event.id,
        meta_json={"section_id": section.id, "title": event.title},
    )
    return jsonify({"event": _serialize_event(event)}), 201


@teacher_bp.put("/calendar/<int:event_id>")
@role_required("teacher")
def update_teacher_calendar_event(event_id):
    event = db.session.get(CalendarEvent, event_id)
    if not event:
        return jsonify({"message": "Calendar event not found."}), 404

    section, error_response = _teacher_section_or_404(event.section_id)
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    next_section_id = payload.get("section_id")
    if next_section_id:
        next_section_id = int(next_section_id)
        _, next_error = _teacher_section_or_404(next_section_id)
        if next_error:
            return next_error
        event.section_id = next_section_id

    for field in ("title", "event_type", "description"):
        if field in payload:
            setattr(event, field, payload[field])
    if "start_at" in payload:
        event.start_at = datetime.fromisoformat(payload["start_at"])
    if "end_at" in payload:
        event.end_at = datetime.fromisoformat(payload["end_at"]) if payload.get("end_at") else None

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.calendar.update",
        entity_type="calendar_event",
        entity_id=event.id,
        meta_json={"section_id": event.section_id, "title": event.title},
    )
    return jsonify({"event": _serialize_event(event)})


@teacher_bp.post("/uploads")
@role_required("teacher")
def teacher_upload_file():
    file = request.files.get("file")
    kind = (request.form.get("kind") or "module").strip().lower()
    if not file:
        return jsonify({"message": "File upload is required."}), 400

    directory_key = "MODULE_UPLOAD_DIR" if kind == "module" else "RESOURCE_UPLOAD_DIR"
    saved_path = _save_uploaded_file(file, current_app.config[directory_key])
    if not saved_path:
        return jsonify({"message": "A valid file name is required."}), 400

    write_audit_log(
        user_id=current_user.id,
        action="teacher.file.upload",
        entity_type="upload",
        meta_json={"kind": kind, "file_path": saved_path},
    )
    return jsonify({"file_path": saved_path, "kind": kind}), 201


@teacher_bp.get("/resources")
@role_required("teacher")
def teacher_resources():
    sections = _teacher_sections()
    section_ids = [section.id for section in sections]
    resources = (
        Resource.query.filter(
            (Resource.uploader_user_id == current_user.id)
            | (
                Resource.section_id.in_(section_ids)
                & (Resource.visibility.in_(("section", "school")))
            )
        )
        .order_by(Resource.created_at.desc())
        .all()
        if section_ids
        else Resource.query.filter_by(uploader_user_id=current_user.id)
        .order_by(Resource.created_at.desc())
        .all()
    )
    return jsonify(
        {
            "sections": [_serialize_section_option(section) for section in sections],
            "resources": [_serialize_resource(resource) for resource in resources],
        }
    )


@teacher_bp.post("/resources")
@role_required("teacher")
def create_teacher_resource():
    payload = request.get_json(silent=True) or {}
    section_id = payload.get("section_id")
    if section_id:
        section_id = int(section_id)
        _, error_response = _teacher_section_or_404(section_id)
        if error_response:
            return error_response

    resource = Resource(
        uploader_user_id=current_user.id,
        section_id=section_id,
        title=payload["title"],
        category=payload.get("category"),
        file_path=payload["file_path"],
        visibility=payload.get("visibility", "section"),
    )
    db.session.add(resource)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.resource.create",
        entity_type="resource",
        entity_id=resource.id,
        meta_json={"section_id": section_id, "title": resource.title},
    )
    return jsonify({"resource": _serialize_resource(resource)}), 201


@teacher_bp.put("/resources/<int:resource_id>")
@role_required("teacher")
def update_teacher_resource(resource_id):
    resource = db.session.get(Resource, resource_id)
    if not resource:
        return jsonify({"message": "Resource not found."}), 404

    allowed_section_ids = set(_teacher_section_ids())
    owns_resource = resource.uploader_user_id == current_user.id
    visible_section = resource.section_id in allowed_section_ids if resource.section_id else owns_resource
    if not owns_resource and not visible_section:
        return jsonify({"message": "You do not have access to this resource."}), 403

    payload = request.get_json(silent=True) or {}
    next_section_id = payload.get("section_id")
    if next_section_id:
        next_section_id = int(next_section_id)
        _, error_response = _teacher_section_or_404(next_section_id)
        if error_response:
            return error_response
        resource.section_id = next_section_id
    elif "section_id" in payload:
        resource.section_id = None

    for field in ("title", "category", "file_path", "visibility"):
        if field in payload:
            setattr(resource, field, payload[field])

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.resource.update",
        entity_type="resource",
        entity_id=resource.id,
        meta_json={"section_id": resource.section_id, "title": resource.title},
    )
    return jsonify({"resource": _serialize_resource(resource)})


@teacher_bp.get("/records")
@role_required("teacher")
def teacher_records():
    report_data = _build_teacher_reports_payload()
    return jsonify(
        {
            "sections": report_data["sections"],
            "class_records": report_data["class_records"],
            "summary": report_data["summary"],
        }
    )


@teacher_bp.get("/performance")
@role_required("teacher")
def teacher_performance():
    return jsonify(_build_teacher_performance_payload())


@teacher_bp.get("/classes/<int:section_id>")
@role_required("teacher")
def get_teacher_class_workspace(section_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    subjects_by_section = _teacher_subjects_by_section()
    modules = (
        Module.query.filter_by(section_id=section.id, teacher_user_id=current_user.id)
        .order_by(Module.created_at.desc())
        .all()
    )
    assignments = (
        Assignment.query.filter_by(section_id=section.id, teacher_user_id=current_user.id)
        .order_by(Assignment.created_at.desc())
        .all()
    )
    assignment_questions = (
        AssignmentQuestion.query.join(Assignment, AssignmentQuestion.assignment_id == Assignment.id)
        .filter(
            Assignment.section_id == section.id,
            Assignment.teacher_user_id == current_user.id,
        )
        .order_by(AssignmentQuestion.sort_order.asc(), AssignmentQuestion.created_at.asc())
        .all()
    )
    questions_by_assignment = {}
    for question in assignment_questions:
        questions_by_assignment.setdefault(question.assignment_id, []).append(
            _serialize_assignment_question(question)
        )
    enrollments = Enrollment.query.filter_by(section_id=section.id, status="active").all()
    students = [
        _serialize_student(db.session.get(User, enrollment.student_user_id))
        for enrollment in enrollments
        if db.session.get(User, enrollment.student_user_id)
    ]
    interventions = (
        Intervention.query.filter_by(section_id=section.id)
        .order_by(Intervention.created_at.desc())
        .all()
    )
    resources = (
        Resource.query.filter(
            Resource.section_id == section.id,
            (Resource.visibility == "section") | (Resource.visibility == "school"),
        )
        .order_by(Resource.created_at.desc())
        .all()
    )
    events = (
        CalendarEvent.query.filter_by(section_id=section.id)
        .order_by(CalendarEvent.start_at.asc())
        .all()
    )
    announcements = (
        Announcement.query.filter_by(section_id=section.id)
        .order_by(Announcement.created_at.desc())
        .all()
    )
    discussion_threads = (
        DiscussionThread.query.filter_by(section_id=section.id)
        .order_by(DiscussionThread.is_pinned.desc(), DiscussionThread.created_at.desc())
        .all()
    )
    submissions = (
        Submission.query.join(Assignment, Submission.assignment_id == Assignment.id)
        .filter(Assignment.section_id == section.id)
        .order_by(Submission.submitted_at.desc(), Submission.created_at.desc())
        .all()
    )

    return jsonify(
        {
            "classroom": {
                **_serialize_section_card(section, subjects_by_section.get(section.id, [])),
                "modules": [_serialize_module(module) for module in modules],
                "assignments": [
                    {
                        **_serialize_assignment(assignment),
                        "questions": questions_by_assignment.get(assignment.id, []),
                    }
                    for assignment in assignments
                ],
                "students": students,
                "interventions": [
                    {
                        "id": intervention.id,
                        "student_user_id": intervention.student_user_id,
                        "status": intervention.status,
                        "teacher_note": intervention.teacher_note,
                        "trigger_score": float(intervention.trigger_score),
                    }
                    for intervention in interventions
                ],
                "resources": [_serialize_resource(resource) for resource in resources],
                "calendar_events": [_serialize_event(event) for event in events],
                "announcements": [
                    _serialize_announcement(announcement) for announcement in announcements
                ],
                "discussion_threads": [
                    _serialize_discussion_thread(thread) for thread in discussion_threads
                ],
                "submissions": [_serialize_submission(submission) for submission in submissions],
            }
        }
    )


@teacher_bp.post("/classes/<int:section_id>/modules")
@role_required("teacher")
def create_teacher_module(section_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    status = _normalize_status(payload.get("status"))
    module = Module(
        section_id=section.id,
        teacher_user_id=current_user.id,
        title=payload["title"],
        description=payload.get("description"),
        subject_tag=payload.get("subject_tag"),
        file_path=payload.get("file_path"),
        published_at=None,
    )
    if status == "published":
        module.published_at = datetime.now(UTC)

    db.session.add(module)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.module.create",
        entity_type="module",
        entity_id=module.id,
        meta_json={"section_id": section.id, "status": status, "title": module.title},
    )
    return jsonify({"module": _serialize_module(module)}), 201


@teacher_bp.put("/classes/<int:section_id>/modules/<int:module_id>")
@role_required("teacher")
def update_teacher_module(section_id, module_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    module = Module.query.filter_by(
        id=module_id,
        section_id=section.id,
        teacher_user_id=current_user.id,
    ).first()
    if not module:
        return jsonify({"message": "Module not found."}), 404

    payload = request.get_json(silent=True) or {}
    if "title" in payload:
        module.title = payload["title"]
    if "description" in payload:
        module.description = payload["description"]
    if "subject_tag" in payload:
        module.subject_tag = payload["subject_tag"]
    if "file_path" in payload:
        module.file_path = payload["file_path"]
    if "status" in payload:
        module.published_at = _announcement_status_to_published_at(payload["status"])

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.module.update",
        entity_type="module",
        entity_id=module.id,
        meta_json={"section_id": section.id, "status": payload.get("status")},
    )
    return jsonify({"module": _serialize_module(module)})


@teacher_bp.post("/classes/<int:section_id>/assignments")
@role_required("teacher")
def create_teacher_assignment(section_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    status = _normalize_status(payload.get("status"))
    assignment = Assignment(
        section_id=section.id,
        teacher_user_id=current_user.id,
        title=payload["title"],
        type=payload["type"],
        instructions=payload.get("instructions"),
        status=status,
    )
    if payload.get("due_at"):
        assignment.due_at = datetime.now(UTC) if payload["due_at"] == "now" else None
    if status == "published":
        assignment.published_at = datetime.now(UTC)

    db.session.add(assignment)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.assignment.create",
        entity_type="assignment",
        entity_id=assignment.id,
        meta_json={"section_id": section.id, "status": status, "title": assignment.title},
    )
    return jsonify({"assignment": _serialize_assignment(assignment)}), 201


@teacher_bp.put("/classes/<int:section_id>/assignments/<int:assignment_id>")
@role_required("teacher")
def update_teacher_assignment(section_id, assignment_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    assignment = Assignment.query.filter_by(
        id=assignment_id,
        section_id=section.id,
        teacher_user_id=current_user.id,
    ).first()
    if not assignment:
        return jsonify({"message": "Assignment not found."}), 404

    payload = request.get_json(silent=True) or {}
    if "title" in payload:
        assignment.title = payload["title"]
    if "type" in payload:
        assignment.type = payload["type"]
    if "instructions" in payload:
        assignment.instructions = payload["instructions"]
    if "due_at" in payload:
        assignment.due_at = _parse_optional_datetime(payload["due_at"])
    if "status" in payload:
        assignment.status = _normalize_status(payload["status"])
        assignment.published_at = _announcement_status_to_published_at(payload["status"])

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.assignment.update",
        entity_type="assignment",
        entity_id=assignment.id,
        meta_json={"section_id": section.id, "status": payload.get("status")},
    )
    return jsonify({"assignment": _serialize_assignment(assignment)})


@teacher_bp.post("/classes/<int:section_id>/assignments/<int:assignment_id>/questions")
@role_required("teacher")
def create_teacher_assignment_question(section_id, assignment_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    assignment = Assignment.query.filter_by(
        id=assignment_id,
        section_id=section.id,
        teacher_user_id=current_user.id,
    ).first()
    if not assignment:
        return jsonify({"message": "Assignment not found."}), 404

    payload = request.get_json(silent=True) or {}
    question = AssignmentQuestion(
        assignment_id=assignment.id,
        question_text=payload["question_text"],
        question_type=payload["question_type"],
        choices_json=payload.get("choices_json"),
        answer_key=payload.get("answer_key"),
        points=payload.get("points", 1),
        sort_order=payload.get("sort_order", 0),
    )
    db.session.add(question)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.assignment_question.create",
        entity_type="assignment_question",
        entity_id=question.id,
        meta_json={"section_id": section.id, "assignment_id": assignment.id},
    )
    return jsonify({"question": _serialize_assignment_question(question)}), 201


@teacher_bp.put("/classes/<int:section_id>/assignments/<int:assignment_id>/questions/<int:question_id>")
@role_required("teacher")
def update_teacher_assignment_question(section_id, assignment_id, question_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    assignment = Assignment.query.filter_by(
        id=assignment_id,
        section_id=section.id,
        teacher_user_id=current_user.id,
    ).first()
    if not assignment:
        return jsonify({"message": "Assignment not found."}), 404

    question = AssignmentQuestion.query.filter_by(
        id=question_id,
        assignment_id=assignment.id,
    ).first()
    if not question:
        return jsonify({"message": "Assignment question not found."}), 404

    payload = request.get_json(silent=True) or {}
    for field in ("question_text", "question_type", "answer_key", "sort_order"):
        if field in payload:
            setattr(question, field, payload[field])
    if "choices_json" in payload:
        question.choices_json = payload["choices_json"]
    if "points" in payload:
        question.points = payload["points"]

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.assignment_question.update",
        entity_type="assignment_question",
        entity_id=question.id,
        meta_json={"section_id": section.id, "assignment_id": assignment.id},
    )
    return jsonify({"question": _serialize_assignment_question(question)})


@teacher_bp.post("/classes/<int:section_id>/announcements")
@role_required("teacher")
def create_teacher_announcement(section_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    status = _normalize_status(payload.get("status"))
    announcement = Announcement(
        author_user_id=current_user.id,
        section_id=section.id,
        title=payload["title"],
        body=payload["body"],
        visibility=payload.get("visibility", "section"),
        published_at=_announcement_status_to_published_at(status),
    )
    db.session.add(announcement)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.announcement.create",
        entity_type="announcement",
        entity_id=announcement.id,
        meta_json={"section_id": section.id, "status": status, "title": announcement.title},
    )
    return jsonify({"announcement": _serialize_announcement(announcement)}), 201


@teacher_bp.put("/classes/<int:section_id>/announcements/<int:announcement_id>")
@role_required("teacher")
def update_teacher_announcement(section_id, announcement_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    announcement = Announcement.query.filter_by(
        id=announcement_id,
        section_id=section.id,
        author_user_id=current_user.id,
    ).first()
    if not announcement:
        return jsonify({"message": "Announcement not found."}), 404

    payload = request.get_json(silent=True) or {}
    if "title" in payload:
        announcement.title = payload["title"]
    if "body" in payload:
        announcement.body = payload["body"]
    if "visibility" in payload:
        announcement.visibility = payload["visibility"]
    if "status" in payload:
        announcement.published_at = _announcement_status_to_published_at(payload["status"])

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.announcement.update",
        entity_type="announcement",
        entity_id=announcement.id,
        meta_json={"section_id": section.id, "status": payload.get("status")},
    )
    return jsonify({"announcement": _serialize_announcement(announcement)})


@teacher_bp.post("/classes/<int:section_id>/discussions")
@role_required("teacher")
def create_teacher_discussion_thread(section_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    payload = request.get_json(silent=True) or {}
    status = _normalize_status(payload.get("status"))
    thread = DiscussionThread(
        author_user_id=current_user.id,
        section_id=section.id,
        title=payload["title"],
        body=payload["body"],
        status=status,
        is_pinned=bool(payload.get("is_pinned", False)),
        published_at=_announcement_status_to_published_at(status),
    )
    db.session.add(thread)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.discussion.create",
        entity_type="discussion_thread",
        entity_id=thread.id,
        meta_json={"section_id": section.id, "status": status, "is_pinned": thread.is_pinned},
    )
    return jsonify({"thread": _serialize_discussion_thread(thread)}), 201


@teacher_bp.put("/classes/<int:section_id>/discussions/<int:thread_id>")
@role_required("teacher")
def update_teacher_discussion_thread(section_id, thread_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    thread = DiscussionThread.query.filter_by(
        id=thread_id,
        section_id=section.id,
        author_user_id=current_user.id,
    ).first()
    if not thread:
        return jsonify({"message": "Discussion thread not found."}), 404

    payload = request.get_json(silent=True) or {}
    if "title" in payload:
        thread.title = payload["title"]
    if "body" in payload:
        thread.body = payload["body"]
    if "is_pinned" in payload:
        thread.is_pinned = bool(payload["is_pinned"])
    if "status" in payload:
        thread.status = _normalize_status(payload["status"])
        thread.published_at = _announcement_status_to_published_at(payload["status"])

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.discussion.update",
        entity_type="discussion_thread",
        entity_id=thread.id,
        meta_json={"section_id": section.id, "status": thread.status, "is_pinned": thread.is_pinned},
    )
    return jsonify({"thread": _serialize_discussion_thread(thread)})


@teacher_bp.post("/classes/<int:section_id>/discussions/<int:thread_id>/replies")
@role_required("teacher")
def create_teacher_discussion_reply(section_id, thread_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    thread = DiscussionThread.query.filter_by(id=thread_id, section_id=section.id).first()
    if not thread:
        return jsonify({"message": "Discussion thread not found."}), 404

    payload = request.get_json(silent=True) or {}
    reply = DiscussionReply(
        thread_id=thread.id,
        author_user_id=current_user.id,
        body=payload["body"],
    )
    db.session.add(reply)
    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.discussion.reply",
        entity_type="discussion_reply",
        entity_id=reply.id,
        meta_json={"section_id": section.id, "thread_id": thread.id},
    )
    return jsonify({"reply": _serialize_discussion_reply(reply)}), 201


@teacher_bp.post("/classes/<int:section_id>/submissions/<int:submission_id>/review")
@role_required("teacher")
def review_teacher_submission(section_id, submission_id):
    section, error_response = _teacher_section_or_404(section_id)
    if error_response:
        return error_response

    submission = db.session.get(Submission, submission_id)
    if not submission:
        return jsonify({"message": "Submission not found."}), 404

    assignment = db.session.get(Assignment, submission.assignment_id)
    if not assignment or assignment.section_id != section.id:
        return jsonify({"message": "Submission does not belong to this class."}), 400

    payload = request.get_json(silent=True) or {}
    raw_score = payload.get("raw_score")
    percentage = payload.get("percentage")
    feedback = payload.get("feedback")

    if raw_score is None or percentage is None:
        return jsonify({"message": "Raw score and percentage are required."}), 400

    submission.raw_score = raw_score
    submission.final_score = percentage
    submission.feedback = feedback
    submission.status = "graded"
    submission.graded_at = datetime.now(UTC)

    grade = Grade.query.filter_by(
        assignment_id=assignment.id,
        student_user_id=submission.student_user_id,
    ).first()
    if not grade:
        grade = Grade(
            section_id=section.id,
            assignment_id=assignment.id,
            student_user_id=submission.student_user_id,
            score=raw_score,
            percentage=percentage,
            remarks="Needs intervention" if float(percentage) < 74 else "Passing",
        )
        db.session.add(grade)
    else:
        grade.score = raw_score
        grade.percentage = percentage
        grade.remarks = "Needs intervention" if float(percentage) < 74 else "Passing"

    intervention = Intervention.query.filter_by(
        section_id=section.id,
        assignment_id=assignment.id,
        student_user_id=submission.student_user_id,
    ).first()
    if float(percentage) < 74:
        if not intervention:
            intervention = Intervention(
                student_user_id=submission.student_user_id,
                section_id=section.id,
                assignment_id=assignment.id,
                trigger_score=percentage,
                status="open",
                teacher_note=feedback,
            )
            db.session.add(intervention)
        else:
            intervention.trigger_score = percentage
            intervention.status = "open"
            intervention.teacher_note = feedback
            intervention.resolved_at = None
    elif intervention:
        intervention.status = "closed"
        intervention.teacher_note = feedback
        intervention.resolved_at = datetime.now(UTC)

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="teacher.submission.review",
        entity_type="submission",
        entity_id=submission.id,
        meta_json={
            "section_id": section.id,
            "assignment_id": assignment.id,
            "student_user_id": submission.student_user_id,
            "percentage": percentage,
        },
    )
    return jsonify(
        {
            "submission": _serialize_submission(submission),
            "grade": {
                "score": float(grade.score),
                "percentage": float(grade.percentage),
                "remarks": grade.remarks,
            },
            "intervention_created": float(percentage) < 74,
        }
    )


@teacher_bp.get("/reports")
@role_required("teacher")
def teacher_reports():
    return jsonify(_build_teacher_reports_payload())


@teacher_bp.get("/reports/export")
@role_required("teacher")
def export_teacher_reports_csv():
    report_data = _build_teacher_reports_payload()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["section", "student", "assignment", "score", "percentage", "remarks"])
    for record in report_data["class_records"]:
        for student in record["students"]:
            if not student["grades"]:
                writer.writerow([record["section_name"], student["student_name"], "", "", "", ""])
                continue
            for grade in student["grades"]:
                writer.writerow(
                    [
                        record["section_name"],
                        student["student_name"],
                        grade["assignment_id"],
                        grade["score"],
                        grade["percentage"],
                        grade["remarks"],
                    ]
                )

    filename = "teacher-reports.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
