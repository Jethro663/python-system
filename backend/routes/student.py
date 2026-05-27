from datetime import UTC, datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user

from extensions import db
from models import (
    Announcement,
    Assignment,
    CalendarEvent,
    DiscussionReply,
    DiscussionThread,
    Enrollment,
    Grade,
    Intervention,
    Module,
    Resource,
    Section,
    Submission,
    User,
)
from routes.admin import role_required


student_bp = Blueprint("student", __name__)


def _student_section_ids():
    enrollments = Enrollment.query.filter_by(student_user_id=current_user.id, status="active").all()
    return [item.section_id for item in enrollments]


def _serialize_section(section):
    return {
        "id": section.id,
        "name": section.name,
        "grade_level": section.grade_level,
        "school_year": section.school_year,
    }


def _serialize_assignment(assignment):
    return {
        "id": assignment.id,
        "title": assignment.title,
        "type": assignment.type,
        "instructions": assignment.instructions,
        "status": assignment.status,
        "published_at": assignment.published_at.isoformat() if assignment.published_at else None,
    }


def _serialize_module(module):
    return {
        "id": module.id,
        "title": module.title,
        "description": module.description,
        "subject_tag": module.subject_tag,
        "file_path": module.file_path,
        "published_at": module.published_at.isoformat() if module.published_at else None,
    }


def _serialize_resource(resource):
    return {
        "id": resource.id,
        "title": resource.title,
        "category": resource.category,
        "file_path": resource.file_path,
        "visibility": resource.visibility,
    }


def _serialize_announcement(announcement):
    return {
        "id": announcement.id,
        "title": announcement.title,
        "body": announcement.body,
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


def _serialize_event(event):
    return {
        "id": event.id,
        "title": event.title,
        "event_type": event.event_type,
        "start_at": event.start_at.isoformat() if event.start_at else None,
        "end_at": event.end_at.isoformat() if event.end_at else None,
        "description": event.description,
    }


def _serialize_result(grade):
    submission = Submission.query.filter_by(
        assignment_id=grade.assignment_id,
        student_user_id=grade.student_user_id,
    ).first()
    assignment = Assignment.query.filter_by(id=grade.assignment_id).first()
    awaiting_review = bool(submission and submission.status == "submitted")
    return {
        "assignment_id": grade.assignment_id,
        "assignment_title": assignment.title if assignment else None,
        "section_id": grade.section_id,
        "score": None if awaiting_review else float(grade.score),
        "percentage": None if awaiting_review else float(grade.percentage),
        "remarks": "Awaiting review" if awaiting_review else grade.remarks,
        "feedback": None if awaiting_review else submission.feedback if submission else None,
        "submission_status": submission.status if submission else None,
    }


def _serialize_submission(submission):
    return {
        "id": submission.id,
        "status": submission.status,
        "response_text": submission.response_text,
        "uploaded_file_path": submission.uploaded_file_path,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "feedback": submission.feedback,
        "final_score": float(submission.final_score) if submission.final_score is not None else None,
    }


@student_bp.get("/dashboard")
@role_required("student")
def student_dashboard():
    section_ids = _student_section_ids()
    sections = (
        Section.query.filter(Section.id.in_(section_ids)).order_by(Section.name.asc()).all()
        if section_ids
        else []
    )
    grades = Grade.query.filter_by(student_user_id=current_user.id).all()
    published_assignments = (
        Assignment.query.filter(
            Assignment.section_id.in_(section_ids), Assignment.status == "published"
        ).count()
        if section_ids
        else 0
    )
    pending_assignments = (
        Assignment.query.filter(
            Assignment.section_id.in_(section_ids), Assignment.status == "published"
        ).count()
        - Submission.query.filter(
            Submission.student_user_id == current_user.id,
            Submission.status.in_(("submitted", "graded")),
        ).count()
        if section_ids
        else 0
    )
    announcements_count = (
        Announcement.query.filter(
            Announcement.section_id.in_(section_ids),
            Announcement.published_at.isnot(None),
        ).count()
        if section_ids
        else 0
    )
    intervention_required = any(float(grade.percentage) < 74 for grade in grades)
    if not intervention_required:
        intervention_required = Intervention.query.filter_by(
            student_user_id=current_user.id,
            status="open",
        ).count() > 0

    return jsonify(
        {
            "summary": {
                "enrolled_sections": len(sections),
                "published_assignments": published_assignments,
                "pending_assignments": max(pending_assignments, 0),
                "latest_results": len(grades),
                "announcements": announcements_count,
                "intervention_required": intervention_required,
            },
            "sections": [_serialize_section(section) for section in sections],
            "results": [_serialize_result(grade) for grade in grades],
        }
    )


@student_bp.get("/classes")
@role_required("student")
def student_classes():
    section_ids = _student_section_ids()
    sections = (
        Section.query.filter(Section.id.in_(section_ids)).order_by(Section.name.asc()).all()
        if section_ids
        else []
    )
    return jsonify({"classes": [_serialize_section(section) for section in sections]})


@student_bp.get("/classes/<int:section_id>")
@role_required("student")
def student_classroom(section_id):
    enrollment = Enrollment.query.filter_by(
        student_user_id=current_user.id,
        section_id=section_id,
        status="active",
    ).first()
    if not enrollment:
        return jsonify({"message": "You do not have access to this class."}), 403

    section = Section.query.filter_by(id=section_id).first()
    modules = (
        Module.query.filter(Module.section_id == section_id, Module.published_at.isnot(None))
        .order_by(Module.created_at.desc())
        .all()
    )
    assignments = (
        Assignment.query.filter(
            Assignment.section_id == section_id,
            Assignment.status == "published",
        )
        .order_by(Assignment.created_at.desc())
        .all()
    )
    resources = (
        Resource.query.filter(
            Resource.section_id == section_id,
            Resource.visibility.in_(("section", "school")),
        )
        .order_by(Resource.created_at.desc())
        .all()
    )
    announcements = (
        Announcement.query.filter(
            Announcement.section_id == section_id,
            Announcement.published_at.isnot(None),
        )
        .order_by(Announcement.created_at.desc())
        .all()
    )
    discussion_threads = (
        DiscussionThread.query.filter(
            DiscussionThread.section_id == section_id,
            DiscussionThread.status == "published",
        )
        .order_by(DiscussionThread.is_pinned.desc(), DiscussionThread.created_at.desc())
        .all()
    )
    events = (
        CalendarEvent.query.filter_by(section_id=section_id)
        .order_by(CalendarEvent.start_at.asc())
        .all()
    )
    submissions = Submission.query.filter_by(student_user_id=current_user.id).all()
    submissions_by_assignment = {item.assignment_id: item for item in submissions}
    grades_by_assignment = {
        grade.assignment_id: grade
        for grade in Grade.query.filter_by(student_user_id=current_user.id, section_id=section_id).all()
    }
    interventions_by_assignment = {
        intervention.assignment_id: intervention
        for intervention in Intervention.query.filter_by(
            student_user_id=current_user.id,
            section_id=section_id,
        ).all()
    }

    return jsonify(
        {
            "classroom": {
                **_serialize_section(section),
                "modules": [_serialize_module(module) for module in modules],
                "assignments": [
                    {
                        **_serialize_assignment(assignment),
                        "submission_status": submissions_by_assignment.get(assignment.id).status
                        if submissions_by_assignment.get(assignment.id)
                        else "pending",
                        "submission": _serialize_submission(submissions_by_assignment.get(assignment.id))
                        if submissions_by_assignment.get(assignment.id)
                        else None,
                        "feedback": submissions_by_assignment.get(assignment.id).feedback
                        if submissions_by_assignment.get(assignment.id)
                        else None,
                        "remedial_access": bool(
                            (
                                grades_by_assignment.get(assignment.id)
                                and float(grades_by_assignment[assignment.id].percentage) < 74
                            )
                            or (
                                interventions_by_assignment.get(assignment.id)
                                and interventions_by_assignment[assignment.id].status == "open"
                            )
                        ),
                    }
                    for assignment in assignments
                ],
                "resources": [_serialize_resource(resource) for resource in resources],
                "announcements": [
                    _serialize_announcement(announcement) for announcement in announcements
                ],
                "discussion_threads": [
                    _serialize_discussion_thread(thread) for thread in discussion_threads
                ],
                "calendar_events": [_serialize_event(event) for event in events],
            }
        }
    )


@student_bp.post("/classes/<int:section_id>/assignments/<int:assignment_id>/submit")
@role_required("student")
def submit_student_assignment(section_id, assignment_id):
    enrollment = Enrollment.query.filter_by(
        student_user_id=current_user.id,
        section_id=section_id,
        status="active",
    ).first()
    if not enrollment:
        return jsonify({"message": "You do not have access to this class."}), 403

    assignment = Assignment.query.filter_by(
        id=assignment_id,
        section_id=section_id,
        status="published",
    ).first()
    if not assignment:
        return jsonify({"message": "Assignment not found."}), 404

    payload = request.get_json(silent=True) or {}
    response_text = (payload.get("response_text") or "").strip()
    uploaded_file_path = (payload.get("uploaded_file_path") or "").strip() or None

    if not response_text and not uploaded_file_path:
        return jsonify({"message": "A written response or uploaded file path is required."}), 400

    submission = Submission.query.filter_by(
        assignment_id=assignment.id,
        student_user_id=current_user.id,
    ).first()
    if not submission:
        submission = Submission(
            assignment_id=assignment.id,
            student_user_id=current_user.id,
        )
        db.session.add(submission)

    submission.response_text = response_text or None
    submission.uploaded_file_path = uploaded_file_path
    submission.status = "submitted"
    submission.submitted_at = datetime.now(UTC)
    submission.raw_score = None
    submission.final_score = None
    submission.feedback = None
    submission.graded_at = None

    db.session.commit()
    return jsonify({"submission": _serialize_submission(submission)})


@student_bp.get("/results")
@role_required("student")
def student_results():
    grades = Grade.query.filter_by(student_user_id=current_user.id).all()
    return jsonify({"results": [_serialize_result(grade) for grade in grades]})
