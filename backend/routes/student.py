from datetime import UTC, datetime
import json

from flask import Blueprint, jsonify, request
from flask_login import current_user

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
    User,
)
from routes.admin import role_required
from services.audit import write_audit_log


student_bp = Blueprint("student", __name__)
MASTERY_THRESHOLD = 74


def _student_section_ids():
    enrollments = Enrollment.query.filter_by(student_user_id=current_user.id, status="active").all()
    return [item.section_id for item in enrollments]


def _section_subjects(section_id):
    return [
        item.subject_name
        for item in SectionTeacher.query.filter_by(section_id=section_id)
        .order_by(SectionTeacher.subject_name.asc())
        .all()
    ]


def _get_or_create_student_profile(user):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if profile:
        return profile

    profile = StudentProfile(user_id=user.id)
    db.session.add(profile)
    db.session.flush()
    return profile


def _serialize_student_profile(user):
    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    return {
        "id": user.id,
        "school_id": user.school_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.full_name,
        "email": user.email,
        "status": user.status,
        "grade_level": profile.grade_level if profile else None,
        "guardian_name": profile.guardian_name if profile else None,
        "guardian_contact": profile.guardian_contact if profile else None,
    }


def _serialize_section(section):
    published_assignment_count = Assignment.query.filter_by(
        section_id=section.id,
        status="published",
    ).count()
    submitted_assignment_count = (
        Submission.query.join(Assignment, Submission.assignment_id == Assignment.id)
        .filter(
            Assignment.section_id == section.id,
            Submission.student_user_id == current_user.id,
            Submission.status.in_(("submitted", "graded")),
        )
        .count()
    )

    return {
        "id": section.id,
        "name": section.name,
        "grade_level": section.grade_level,
        "school_year": section.school_year,
        "schedule_text": section.schedule_text,
        "status": section.status,
        "subjects": _section_subjects(section.id),
        "module_count": Module.query.filter(
            Module.section_id == section.id,
            Module.published_at.isnot(None),
        ).count(),
        "assignment_count": published_assignment_count,
        "pending_assignment_count": max(
            published_assignment_count - submitted_assignment_count,
            0,
        ),
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


def _format_points(value):
    number = float(value or 0)
    return int(number) if number.is_integer() else round(number, 2)


def _serialize_assignment_question(question):
    return {
        "id": question.id,
        "assignment_id": question.assignment_id,
        "question_text": question.question_text,
        "question_type": question.question_type,
        "choices_json": question.choices_json or [],
        "points": float(question.points),
        "sort_order": question.sort_order,
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
        "visibility": thread.visibility,
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
    section = Section.query.filter_by(id=grade.section_id).first()
    awaiting_review = bool(submission and submission.status == "submitted")
    return {
        "assignment_id": grade.assignment_id,
        "assignment_title": assignment.title if assignment else None,
        "assignment_type": assignment.type if assignment else None,
        "section_id": grade.section_id,
        "section_name": section.name if section else None,
        "score": None if awaiting_review else float(grade.score),
        "percentage": None if awaiting_review else float(grade.percentage),
        "remarks": "Awaiting review" if awaiting_review else grade.remarks,
        "feedback": None if awaiting_review else submission.feedback if submission else None,
        "submission_status": submission.status if submission else None,
        "submission": _serialize_submission(submission) if submission else None,
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
    response_payload = _parse_submission_response_payload(submission)
    return {
        "id": submission.id,
        "status": submission.status,
        "response_text": _submission_response_summary(response_payload)
        if response_payload
        else submission.response_text,
        "response_payload": response_payload,
        "responses": response_payload.get("responses", []) if response_payload else [],
        "uploaded_file_path": submission.uploaded_file_path,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "feedback": submission.feedback,
        "final_score": float(submission.final_score) if submission.final_score is not None else None,
        "raw_score": float(submission.raw_score) if submission.raw_score is not None else None,
        "graded_at": submission.graded_at.isoformat() if submission.graded_at else None,
    }


def _response_map_from_payload(payload):
    responses = payload.get("responses")
    if responses is None:
        responses = payload.get("answers")

    if isinstance(responses, dict):
        return {str(key): value for key, value in responses.items()}

    if isinstance(responses, list):
        mapped = {}
        for response in responses:
            if not isinstance(response, dict):
                continue
            question_id = response.get("question_id") or response.get("questionId") or response.get("id")
            if question_id is None:
                continue
            answer = (
                response.get("answer")
                if "answer" in response
                else response.get("studentAnswer")
                if "studentAnswer" in response
                else response.get("selectedOptionId")
                if "selectedOptionId" in response
                else response.get("selectedOptionIds")
            )
            mapped[str(question_id)] = answer
        return mapped

    return {}


def _answer_is_blank(value):
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return not value
    return False


def _answer_to_text(value):
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    if value is None:
        return ""
    return str(value)


def _normalize_answer(value):
    return " ".join(_answer_to_text(value).strip().lower().split())


def _answers_match(student_answer, answer_key):
    expected_answers = [
        item.strip()
        for item in str(answer_key or "").split("|")
        if item.strip()
    ]
    normalized_student = _normalize_answer(student_answer)
    return any(_normalize_answer(expected) == normalized_student for expected in expected_answers)


def _evaluate_question_responses(questions, response_map):
    total_points = sum(float(question.points or 0) for question in questions)
    earned_points = 0
    auto_gradable = bool(questions)
    structured_responses = []

    for question in questions:
        answer = response_map.get(str(question.id))
        if _answer_is_blank(answer):
            return (
                None,
                None,
                None,
                False,
                "Please answer every assessment question before submitting.",
            )

        can_auto_grade = question.question_type in ("multiple_choice", "short_answer")
        has_answer_key = bool((question.answer_key or "").strip())
        is_correct = None
        question_points = float(question.points or 0)
        earned = None

        if can_auto_grade and has_answer_key:
            is_correct = _answers_match(answer, question.answer_key)
            earned = question_points if is_correct else 0
            earned_points += earned
        else:
            auto_gradable = False

        structured_responses.append(
            {
                "question_id": question.id,
                "question_text": question.question_text,
                "question_type": question.question_type,
                "answer": answer,
                "points": question_points,
                "earned_points": earned,
                "is_correct": is_correct,
            }
        )

    return structured_responses, earned_points, total_points, auto_gradable, None


def _build_question_response_payload(structured_responses):
    summary = "\n".join(
        f"{response['question_text']}: {_answer_to_text(response.get('answer'))}"
        for response in structured_responses
    )
    return {
        "kind": "question_responses",
        "summary": summary,
        "responses": structured_responses,
    }


def _serialize_grade_result(grade, submission):
    awaiting_review = bool(submission and submission.status == "submitted")
    if not grade:
        return None

    return {
        "score": None if awaiting_review else float(grade.score),
        "percentage": None if awaiting_review else float(grade.percentage),
        "remarks": "Awaiting review" if awaiting_review else grade.remarks,
    }


def _upsert_grade_and_intervention(section_id, assignment, submission, raw_score, percentage, feedback):
    grade = Grade.query.filter_by(
        assignment_id=assignment.id,
        student_user_id=submission.student_user_id,
    ).first()
    remarks = "Needs support" if float(percentage) < MASTERY_THRESHOLD else "Passing"

    if not grade:
        grade = Grade(
            section_id=section_id,
            assignment_id=assignment.id,
            student_user_id=submission.student_user_id,
            score=raw_score,
            percentage=percentage,
            remarks=remarks,
        )
        db.session.add(grade)
    else:
        grade.section_id = section_id
        grade.score = raw_score
        grade.percentage = percentage
        grade.remarks = remarks

    intervention = Intervention.query.filter_by(
        section_id=section_id,
        assignment_id=assignment.id,
        student_user_id=submission.student_user_id,
    ).first()
    if float(percentage) < MASTERY_THRESHOLD:
        if not intervention:
            intervention = Intervention(
                student_user_id=submission.student_user_id,
                section_id=section_id,
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

    return grade


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
        - Submission.query.join(Assignment, Submission.assignment_id == Assignment.id)
        .filter(
            Assignment.section_id.in_(section_ids),
            Submission.student_user_id == current_user.id,
            Submission.status.in_(("submitted", "graded")),
        )
        .count()
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


@student_bp.get("/profile")
@role_required("student")
def student_profile():
    return jsonify({"profile": _serialize_student_profile(current_user)})


@student_bp.put("/profile")
@role_required("student")
def update_student_profile():
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

    profile = _get_or_create_student_profile(current_user)
    profile.grade_level = payload.get("grade_level")
    profile.guardian_name = payload.get("guardian_name")
    profile.guardian_contact = payload.get("guardian_contact")

    db.session.commit()
    write_audit_log(
        user_id=current_user.id,
        action="student.profile.update",
        entity_type="user",
        entity_id=current_user.id,
        meta_json={"email": current_user.email},
    )
    return jsonify({"profile": _serialize_student_profile(current_user)})


@student_bp.post("/profile/password")
@role_required("student")
def change_student_password():
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
        action="student.profile.change_password",
        entity_type="user",
        entity_id=current_user.id,
        meta_json={"email": current_user.email},
    )
    return jsonify({"message": "Password updated."})


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
    assignment_ids = [assignment.id for assignment in assignments]
    assignment_questions = (
        AssignmentQuestion.query.filter(AssignmentQuestion.assignment_id.in_(assignment_ids))
        .order_by(AssignmentQuestion.sort_order.asc(), AssignmentQuestion.created_at.asc())
        .all()
        if assignment_ids
        else []
    )
    questions_by_assignment = {}
    for question in assignment_questions:
        questions_by_assignment.setdefault(question.assignment_id, []).append(
            _serialize_assignment_question(question)
        )
    resources = (
        Resource.query.filter(
            (
                (Resource.section_id == section_id)
                & Resource.visibility.in_(("section", "school"))
            )
            | ((Resource.section_id.is_(None)) & (Resource.visibility == "school"))
        )
        .order_by(Resource.created_at.desc())
        .all()
    )
    announcements = (
        Announcement.query.filter(
            (Announcement.section_id == section_id) | (Announcement.visibility == "school"),
            Announcement.published_at.isnot(None),
        )
        .order_by(Announcement.created_at.desc())
        .all()
    )
    discussion_threads = (
        DiscussionThread.query.filter(
            (DiscussionThread.section_id == section_id) | (DiscussionThread.visibility == "school"),
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
                        "questions": questions_by_assignment.get(assignment.id, []),
                        "result": _serialize_grade_result(
                            grades_by_assignment.get(assignment.id),
                            submissions_by_assignment.get(assignment.id),
                        ),
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
    questions = (
        AssignmentQuestion.query.filter_by(assignment_id=assignment.id)
        .order_by(AssignmentQuestion.sort_order.asc(), AssignmentQuestion.created_at.asc())
        .all()
    )

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

    submission.uploaded_file_path = uploaded_file_path
    submission.submitted_at = datetime.now(UTC)

    result = None
    if questions:
        response_map = _response_map_from_payload(payload)
        (
            structured_responses,
            earned_points,
            total_points,
            auto_gradable,
            validation_error,
        ) = _evaluate_question_responses(questions, response_map)
        if validation_error:
            return jsonify({"message": validation_error}), 400

        submission.response_text = json.dumps(_build_question_response_payload(structured_responses))
        if auto_gradable:
            percentage = round((earned_points / total_points) * 100, 2) if total_points else 0
            feedback = (
                f"Auto-graded: {_format_points(earned_points)} of "
                f"{_format_points(total_points)} points."
            )
            submission.status = "graded"
            submission.raw_score = earned_points
            submission.final_score = percentage
            submission.feedback = feedback
            submission.graded_at = datetime.now(UTC)
            grade = _upsert_grade_and_intervention(
                section_id,
                assignment,
                submission,
                earned_points,
                percentage,
                feedback,
            )
            result = {
                "score": float(grade.score),
                "percentage": float(grade.percentage),
                "remarks": grade.remarks,
            }
        else:
            submission.status = "submitted"
            submission.raw_score = None
            submission.final_score = None
            submission.feedback = None
            submission.graded_at = None
    else:
        if not response_text and not uploaded_file_path:
            return jsonify({"message": "A written response or uploaded file path is required."}), 400

        submission.response_text = response_text or None
        submission.status = "submitted"
        submission.raw_score = None
        submission.final_score = None
        submission.feedback = None
        submission.graded_at = None

    db.session.commit()
    return jsonify({"submission": _serialize_submission(submission), "result": result})


@student_bp.get("/results")
@role_required("student")
def student_results():
    grades = Grade.query.filter_by(student_user_id=current_user.id).all()
    return jsonify({"results": [_serialize_result(grade) for grade in grades]})
