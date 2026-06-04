from datetime import UTC, datetime

from app import create_app
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
    Role,
    Section,
    SectionTeacher,
    StudentProfile,
    Submission,
    User,
)


def create_user(role_name, email, school_id, password="Test@123"):
    role = Role.query.filter_by(name=role_name).first()
    if not role:
        role = Role(name=role_name)
        db.session.add(role)
        db.session.flush()

    user = User(
        school_id=school_id,
        role_id=role.id,
        first_name=role_name.title(),
        last_name="User",
        email=email,
        password_hash=password,
        status="active",
    )
    db.session.add(user)
    db.session.commit()
    return user


def login_as(client, email, password="Test@123"):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200


def test_teacher_dashboard_returns_assigned_sections_and_pending_work():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "student@example.com", "S-001")
        section = Section(
            name="Section A",
            grade_level="Grade 10",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            SectionTeacher(
                section_id=section.id,
                teacher_user_id=teacher.id,
                subject_name="Mathematics",
            )
        )
        db.session.add(
            Enrollment(section_id=section.id, student_user_id=student.id, status="active")
        )
        db.session.add(
            Assignment(
                section_id=section.id,
                teacher_user_id=teacher.id,
                title="Quiz 1",
                type="quiz",
                instructions="Solve the items.",
                status="draft",
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "teacher@example.com")

    response = client.get("/api/teacher/dashboard")

    assert response.status_code == 200
    body = response.get_json()
    assert body["summary"]["assigned_sections"] == 1
    assert body["summary"]["enrolled_students"] == 1
    assert body["summary"]["draft_assignments"] == 1
    assert body["sections"][0]["name"] == "Section A"


def test_student_dashboard_returns_enrollments_results_and_intervention_flag():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "student@example.com", "S-001")
        section = Section(
            name="Section A",
            grade_level="Grade 10",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            Enrollment(section_id=section.id, student_user_id=student.id, status="active")
        )
        assignment = Assignment(
            section_id=section.id,
            teacher_user_id=teacher.id,
            title="Quiz 1",
            type="quiz",
            instructions="Solve the items.",
            status="published",
        )
        db.session.add(assignment)
        db.session.flush()
        db.session.add(
            Grade(
                section_id=section.id,
                assignment_id=assignment.id,
                student_user_id=student.id,
                score=18,
                percentage=72,
                remarks="Needs support",
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "student@example.com")

    response = client.get("/api/student/dashboard")

    assert response.status_code == 200
    body = response.get_json()
    assert body["summary"]["enrolled_sections"] == 1
    assert body["summary"]["published_assignments"] == 1
    assert body["summary"]["intervention_required"] is True
    assert body["sections"][0]["name"] == "Section A"


def test_student_can_update_profile_and_password():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        student = create_user("student", "student@example.com", "S-001")
        db.session.add(
            StudentProfile(
                user_id=student.id,
                grade_level="Grade 9",
                guardian_name="Original Guardian",
                guardian_contact="old@example.com",
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "student@example.com")

    profile_response = client.get("/api/student/profile")
    assert profile_response.status_code == 200
    assert profile_response.get_json()["profile"]["guardian_name"] == "Original Guardian"

    update_response = client.put(
        "/api/student/profile",
        json={
            "first_name": "Updated",
            "last_name": "Learner",
            "school_id": "S-UPDATED",
            "email": "student.updated@example.com",
            "grade_level": "Grade 10",
            "guardian_name": "Updated Guardian",
            "guardian_contact": "guardian@example.com",
        },
    )
    assert update_response.status_code == 200
    updated = update_response.get_json()["profile"]
    assert updated["full_name"] == "Updated Learner"
    assert updated["email"] == "student.updated@example.com"
    assert updated["grade_level"] == "Grade 10"
    assert updated["guardian_contact"] == "guardian@example.com"

    password_response = client.post(
        "/api/student/profile/password",
        json={"current_password": "Test@123", "new_password": "NewStudent123!"},
    )
    assert password_response.status_code == 200

    client.post("/api/auth/logout")
    login_response = client.post(
        "/api/auth/login",
        json={"email": "student.updated@example.com", "password": "NewStudent123!"},
    )
    assert login_response.status_code == 200


def test_student_classroom_returns_modules_resources_announcements_calendar_and_results():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "student@example.com", "S-001")
        section = Section(
            name="Section B",
            grade_level="Grade 11",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            Enrollment(section_id=section.id, student_user_id=student.id, status="active")
        )
        assignment = Assignment(
            section_id=section.id,
            teacher_user_id=teacher.id,
            title="Essay 1",
            type="written_work",
            instructions="Write a reflection.",
            status="published",
        )
        db.session.add(assignment)
        db.session.flush()
        db.session.add(
            Module(
                section_id=section.id,
                teacher_user_id=teacher.id,
                title="Reading Pack",
                description="Week 1 reading",
                file_path="/files/reading-pack.pdf",
                published_at=datetime.now(UTC),
            )
        )
        db.session.add(
            Resource(
                uploader_user_id=teacher.id,
                section_id=section.id,
                title="Formula Sheet",
                category="PDF",
                file_path="/files/formula-sheet.pdf",
                visibility="section",
            )
        )
        db.session.add(
            Announcement(
                author_user_id=teacher.id,
                section_id=section.id,
                title="Welcome",
                body="First class starts Monday.",
                visibility="section",
                published_at=datetime.now(UTC),
            )
        )
        thread = DiscussionThread(
            author_user_id=teacher.id,
            section_id=section.id,
            title="Unit 1 Help Thread",
            body="Ask your reading questions here.",
            status="published",
            is_pinned=True,
            published_at=datetime.now(UTC),
        )
        db.session.add(thread)
        db.session.flush()
        db.session.add(
            DiscussionReply(
                thread_id=thread.id,
                author_user_id=teacher.id,
                body="Remember to cite page numbers in your answers.",
            )
        )
        db.session.add(
            CalendarEvent(
                title="Orientation",
                section_id=section.id,
                start_at=datetime.now(UTC),
                event_type="meeting",
                description="Bring materials.",
            )
        )
        db.session.add(
            Submission(
                assignment_id=assignment.id,
                student_user_id=student.id,
                status="graded",
                response_text="My reflection draft",
                uploaded_file_path="/uploads/essay-1.docx",
                feedback="Good work",
            )
        )
        db.session.add(
            Grade(
                section_id=section.id,
                assignment_id=assignment.id,
                student_user_id=student.id,
                score=23,
                percentage=92,
                remarks="Passing",
            )
        )
        db.session.commit()
        section_id = section.id

    client = app.test_client()
    login_as(client, "student@example.com")

    dashboard_response = client.get("/api/student/dashboard")
    assert dashboard_response.status_code == 200
    dashboard_body = dashboard_response.get_json()
    assert dashboard_body["summary"]["announcements"] == 1
    assert dashboard_body["summary"]["pending_assignments"] == 0

    classes_response = client.get("/api/student/classes")
    assert classes_response.status_code == 200
    assert classes_response.get_json()["classes"][0]["name"] == "Section B"

    classroom_response = client.get(f"/api/student/classes/{section_id}")
    assert classroom_response.status_code == 200
    classroom = classroom_response.get_json()["classroom"]
    assert classroom["modules"][0]["title"] == "Reading Pack"
    assert classroom["resources"][0]["title"] == "Formula Sheet"
    assert classroom["announcements"][0]["title"] == "Welcome"
    assert classroom["discussion_threads"][0]["title"] == "Unit 1 Help Thread"
    assert classroom["discussion_threads"][0]["replies"][0]["body"].startswith("Remember to cite")
    assert classroom["calendar_events"][0]["title"] == "Orientation"
    assert classroom["assignments"][0]["submission_status"] == "graded"
    assert classroom["assignments"][0]["submission"]["response_text"] == "My reflection draft"
    assert classroom["assignments"][0]["feedback"] == "Good work"

    results_response = client.get("/api/student/results")
    assert results_response.status_code == 200
    result = results_response.get_json()["results"][0]
    assert result["assignment_title"] == "Essay 1"
    assert result["feedback"] == "Good work"
    assert result["submission_status"] == "graded"


def test_student_can_submit_assignment_and_see_remedial_access():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "student@example.com", "S-001")
        section = Section(
            name="Section Remedial",
            grade_level="Grade 9",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            Enrollment(section_id=section.id, student_user_id=student.id, status="active")
        )
        assignment = Assignment(
            section_id=section.id,
            teacher_user_id=teacher.id,
            title="Remedial Quiz",
            type="quiz",
            instructions="Answer the items.",
            status="published",
        )
        db.session.add(assignment)
        db.session.commit()
        section_id = section.id
        assignment_id = assignment.id

    client = app.test_client()
    login_as(client, "student@example.com")

    submit_response = client.post(
        f"/api/student/classes/{section_id}/assignments/{assignment_id}/submit",
        json={
            "response_text": "My initial answer",
            "uploaded_file_path": "/uploads/remedial-quiz.pdf",
        },
    )
    assert submit_response.status_code == 200
    assert submit_response.get_json()["submission"]["status"] == "submitted"

    with app.app_context():
        db.session.add(
            Grade(
                section_id=section_id,
                assignment_id=assignment_id,
                student_user_id=User.query.filter_by(email="student@example.com").first().id,
                score=14,
                percentage=70,
                remarks="Needs support",
            )
        )
        db.session.add(
            Intervention(
                student_user_id=User.query.filter_by(email="student@example.com").first().id,
                section_id=section_id,
                assignment_id=assignment_id,
                trigger_score=70,
                status="open",
                teacher_note="Review weak areas",
            )
        )
        db.session.commit()

    classroom_response = client.get(f"/api/student/classes/{section_id}")
    assert classroom_response.status_code == 200
    assignment = classroom_response.get_json()["classroom"]["assignments"][0]
    assert assignment["submission_status"] == "submitted"
    assert assignment["submission"]["uploaded_file_path"] == "/uploads/remedial-quiz.pdf"
    assert assignment["remedial_access"] is True


def test_student_can_answer_question_assessment_and_teacher_sees_result():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "student@example.com", "S-001")
        section = Section(
            name="Section Assessment",
            grade_level="Grade 10",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            SectionTeacher(
                section_id=section.id,
                teacher_user_id=teacher.id,
                subject_name="Mathematics",
            )
        )
        db.session.add(
            Enrollment(section_id=section.id, student_user_id=student.id, status="active")
        )
        assignment = Assignment(
            section_id=section.id,
            teacher_user_id=teacher.id,
            title="Readiness Check",
            type="quiz",
            instructions="Answer all items.",
            status="published",
        )
        db.session.add(assignment)
        db.session.flush()
        first_question = AssignmentQuestion(
            assignment_id=assignment.id,
            question_text="What is 2 + 2?",
            question_type="multiple_choice",
            choices_json=["3", "4", "5"],
            answer_key="4",
            points=5,
            sort_order=1,
        )
        second_question = AssignmentQuestion(
            assignment_id=assignment.id,
            question_text="Type blue.",
            question_type="short_answer",
            answer_key="blue",
            points=5,
            sort_order=2,
        )
        db.session.add_all([first_question, second_question])
        db.session.commit()
        section_id = section.id
        assignment_id = assignment.id
        first_question_id = first_question.id
        second_question_id = second_question.id

    client = app.test_client()
    login_as(client, "student@example.com")

    classroom_response = client.get(f"/api/student/classes/{section_id}")
    assert classroom_response.status_code == 200
    classroom_assignment = classroom_response.get_json()["classroom"]["assignments"][0]
    assert classroom_assignment["questions"][0]["question_text"] == "What is 2 + 2?"
    assert "answer_key" not in classroom_assignment["questions"][0]

    submit_response = client.post(
        f"/api/student/classes/{section_id}/assignments/{assignment_id}/submit",
        json={
            "responses": {
                str(first_question_id): "4",
                str(second_question_id): "blue",
            }
        },
    )
    assert submit_response.status_code == 200
    submitted = submit_response.get_json()["submission"]
    assert submitted["status"] == "graded"
    assert submitted["final_score"] == 100.0
    assert submitted["responses"][0]["is_correct"] is True

    results_response = client.get("/api/student/results")
    assert results_response.status_code == 200
    result = results_response.get_json()["results"][0]
    assert result["assignment_title"] == "Readiness Check"
    assert result["percentage"] == 100.0
    assert result["submission_status"] == "graded"

    login_as(client, "teacher@example.com")
    teacher_workspace_response = client.get(f"/api/teacher/classes/{section_id}")
    assert teacher_workspace_response.status_code == 200
    teacher_submission = teacher_workspace_response.get_json()["classroom"]["submissions"][0]
    assert teacher_submission["assignment_title"] == "Readiness Check"
    assert teacher_submission["student_name"] == "Student User"
    assert teacher_submission["status"] == "graded"
    assert teacher_submission["final_score"] == 100.0
    assert teacher_submission["responses"][1]["answer"] == "blue"


def test_student_resubmission_clears_stale_grading_state_until_teacher_reviews_again():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "student@example.com", "S-001")
        section = Section(
            name="Section Review",
            grade_level="Grade 10",
            school_year="2026-2027",
            adviser_user_id=teacher.id,
            status="active",
        )
        db.session.add(section)
        db.session.flush()
        db.session.add(
            Enrollment(section_id=section.id, student_user_id=student.id, status="active")
        )
        assignment = Assignment(
            section_id=section.id,
            teacher_user_id=teacher.id,
            title="Revision Task",
            type="written_work",
            instructions="Revise the response.",
            status="published",
        )
        db.session.add(assignment)
        db.session.flush()
        db.session.add(
            Submission(
                assignment_id=assignment.id,
                student_user_id=student.id,
                status="graded",
                response_text="Original answer",
                feedback="Old feedback",
                raw_score=2,
                final_score=40,
                graded_at=datetime.now(UTC),
                submitted_at=datetime.now(UTC),
            )
        )
        db.session.add(
            Grade(
                section_id=section.id,
                assignment_id=assignment.id,
                student_user_id=student.id,
                score=2,
                percentage=40,
                remarks="Needs support",
            )
        )
        db.session.add(
            Intervention(
                student_user_id=student.id,
                section_id=section.id,
                assignment_id=assignment.id,
                trigger_score=40,
                status="open",
                teacher_note="Redo this work",
            )
        )
        db.session.commit()
        section_id = section.id
        assignment_id = assignment.id

    client = app.test_client()
    login_as(client, "student@example.com")

    submit_response = client.post(
        f"/api/student/classes/{section_id}/assignments/{assignment_id}/submit",
        json={"response_text": "Updated answer after remediation"},
    )
    assert submit_response.status_code == 200
    assert submit_response.get_json()["submission"]["status"] == "submitted"
    assert submit_response.get_json()["submission"]["final_score"] is None
    assert submit_response.get_json()["submission"]["feedback"] is None

    classroom_response = client.get(f"/api/student/classes/{section_id}")
    assert classroom_response.status_code == 200
    assignment_payload = classroom_response.get_json()["classroom"]["assignments"][0]
    assert assignment_payload["submission_status"] == "submitted"
    assert assignment_payload["feedback"] is None
    assert assignment_payload["submission"]["final_score"] is None
    assert assignment_payload["remedial_access"] is True

    results_response = client.get("/api/student/results")
    assert results_response.status_code == 200
    result = results_response.get_json()["results"][0]
    assert result["submission_status"] == "submitted"
    assert result["score"] is None
    assert result["percentage"] is None
    assert result["remarks"] == "Awaiting review"
    assert result["feedback"] is None

    dashboard_response = client.get("/api/student/dashboard")
    assert dashboard_response.status_code == 200
    assert dashboard_response.get_json()["summary"]["intervention_required"] is True
