from datetime import UTC, datetime
from io import BytesIO
from tempfile import TemporaryDirectory

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
    Resource,
    Role,
    Section,
    SectionTeacher,
    Submission,
    StudentProfile,
    TeacherProfile,
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


def test_teacher_class_workspace_and_publish_flows():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        student = create_user("student", "student@example.com", "S-001")
        db.session.add(
            StudentProfile(
                user_id=student.id,
                grade_level="Grade 10",
                guardian_name="Guardian",
                guardian_contact="0912",
            )
        )
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
            Intervention(
                student_user_id=student.id,
                section_id=section.id,
                assignment_id=1,
                trigger_score=70,
                status="open",
                teacher_note="Review algebra basics",
            )
        )
        db.session.add(
            Resource(
                uploader_user_id=teacher.id,
                section_id=section.id,
                title="Section Handbook",
                category="PDF",
                file_path="/files/handbook.pdf",
                visibility="section",
            )
        )
        db.session.add(
            CalendarEvent(
                title="Quarter Quiz",
                section_id=section.id,
                start_at=datetime.now(UTC),
                event_type="assessment",
                description="Prepare notebooks",
            )
        )
        assignment = Assignment(
            section_id=section.id,
            teacher_user_id=teacher.id,
            title="Preloaded Quiz",
            type="quiz",
            instructions="Initial quiz",
            status="published",
        )
        db.session.add(assignment)
        db.session.flush()
        db.session.add(
            Submission(
                assignment_id=assignment.id,
                student_user_id=student.id,
                submitted_at=datetime.now(UTC),
                status="submitted",
            )
        )
        db.session.commit()
        section_id = section.id
        assignment_id = assignment.id

    client = app.test_client()
    login_as(client, "teacher@example.com")

    classes_response = client.get("/api/teacher/classes")
    assert classes_response.status_code == 200
    assert classes_response.get_json()["classes"][0]["student_count"] == 1

    dashboard_response = client.get("/api/teacher/dashboard")
    assert dashboard_response.status_code == 200
    assert dashboard_response.get_json()["summary"]["pending_submissions"] == 1

    module_response = client.post(
        f"/api/teacher/classes/{section_id}/modules",
        json={
            "title": "Week 1 Fractions",
            "description": "Module packet",
            "subject_tag": "Mathematics",
            "file_path": "/files/week-1.pdf",
            "status": "published",
        },
    )
    assert module_response.status_code == 201
    assert module_response.get_json()["module"]["status"] == "published"
    assert module_response.get_json()["module"]["subject_tag"] == "Mathematics"
    module_id = module_response.get_json()["module"]["id"]

    module_update_response = client.put(
        f"/api/teacher/classes/{section_id}/modules/{module_id}",
        json={
            "title": "Week 1 Fractions Revised",
            "description": "Updated module packet",
            "subject_tag": "Algebra",
            "file_path": "/files/week-1-revised.pdf",
            "status": "draft",
        },
    )
    assert module_update_response.status_code == 200
    assert module_update_response.get_json()["module"]["status"] == "draft"
    assert module_update_response.get_json()["module"]["subject_tag"] == "Algebra"

    assignment_response = client.post(
        f"/api/teacher/classes/{section_id}/assignments",
        json={
            "title": "Quiz 1",
            "type": "quiz",
            "instructions": "Answer all items.",
            "status": "published",
        },
    )
    assert assignment_response.status_code == 201
    assert assignment_response.get_json()["assignment"]["status"] == "published"
    assignment_created_id = assignment_response.get_json()["assignment"]["id"]

    assignment_update_response = client.put(
        f"/api/teacher/classes/{section_id}/assignments/{assignment_created_id}",
        json={
            "title": "Quiz 1 Retake",
            "type": "quiz",
            "instructions": "Answer all revised items.",
            "status": "draft",
        },
    )
    assert assignment_update_response.status_code == 200
    assert assignment_update_response.get_json()["assignment"]["status"] == "draft"

    question_response = client.post(
        f"/api/teacher/classes/{section_id}/assignments/{assignment_created_id}/questions",
        json={
            "question_text": "What is 2 + 2?",
            "question_type": "multiple_choice",
            "choices_json": ["3", "4", "5"],
            "answer_key": "4",
            "points": 5,
            "sort_order": 1,
        },
    )
    assert question_response.status_code == 201
    question_id = question_response.get_json()["question"]["id"]
    assert question_response.get_json()["question"]["points"] == 5.0

    question_update_response = client.put(
        f"/api/teacher/classes/{section_id}/assignments/{assignment_created_id}/questions/{question_id}",
        json={
            "question_text": "What is 3 + 3?",
            "points": 10,
            "sort_order": 2,
        },
    )
    assert question_update_response.status_code == 200
    assert question_update_response.get_json()["question"]["question_text"] == "What is 3 + 3?"
    assert question_update_response.get_json()["question"]["points"] == 10.0

    announcement_response = client.post(
        f"/api/teacher/classes/{section_id}/announcements",
        json={
            "title": "Bring calculators",
            "body": "Quiz moves to Friday.",
            "status": "published",
            "visibility": "section",
        },
    )
    assert announcement_response.status_code == 201
    assert announcement_response.get_json()["announcement"]["status"] == "published"
    announcement_id = announcement_response.get_json()["announcement"]["id"]

    update_announcement_response = client.put(
        f"/api/teacher/classes/{section_id}/announcements/{announcement_id}",
        json={
            "title": "Bring calculators and rulers",
            "body": "Quiz moves to next Monday.",
            "status": "draft",
            "visibility": "section",
        },
    )
    assert update_announcement_response.status_code == 200
    assert update_announcement_response.get_json()["announcement"]["status"] == "draft"

    discussion_response = client.post(
        f"/api/teacher/classes/{section_id}/discussions",
        json={
            "title": "Week 1 Questions",
            "body": "Post your algebra blockers here.",
            "status": "published",
            "is_pinned": True,
        },
    )
    assert discussion_response.status_code == 201
    assert discussion_response.get_json()["thread"]["status"] == "published"
    discussion_id = discussion_response.get_json()["thread"]["id"]

    update_discussion_response = client.put(
        f"/api/teacher/classes/{section_id}/discussions/{discussion_id}",
        json={
            "title": "Week 1 Questions and Tips",
            "body": "Post blockers and review the pinned hints.",
            "status": "draft",
            "is_pinned": False,
        },
    )
    assert update_discussion_response.status_code == 200
    assert update_discussion_response.get_json()["thread"]["status"] == "draft"

    discussion_reply_response = client.post(
        f"/api/teacher/classes/{section_id}/discussions/{discussion_id}/replies",
        json={"body": "Start with items 1 to 3 and compare your steps."},
    )
    assert discussion_reply_response.status_code == 201
    assert discussion_reply_response.get_json()["reply"]["body"].startswith("Start with items")

    workspace_response = client.get(f"/api/teacher/classes/{section_id}")
    assert workspace_response.status_code == 200
    classroom = workspace_response.get_json()["classroom"]
    assert classroom["name"] == "Section A"
    assert classroom["student_count"] == 1
    assert classroom["modules"][0]["title"] == "Week 1 Fractions Revised"
    assert classroom["modules"][0]["status"] == "draft"
    assert classroom["modules"][0]["subject_tag"] == "Algebra"
    assert classroom["assignments"][0]["title"] == "Quiz 1 Retake"
    assert classroom["assignments"][0]["status"] == "draft"
    assert classroom["assignments"][0]["questions"][0]["question_text"] == "What is 3 + 3?"
    assert classroom["students"][0]["intervention_status"] == "open"
    assert classroom["resources"][0]["title"] == "Section Handbook"
    assert classroom["calendar_events"][0]["title"] == "Quarter Quiz"
    assert classroom["announcements"][0]["title"] == "Bring calculators and rulers"
    assert classroom["announcements"][0]["status"] == "draft"
    assert classroom["discussion_threads"][0]["title"] == "Week 1 Questions and Tips"
    assert classroom["discussion_threads"][0]["replies"][0]["body"].startswith("Start with items")
    assert classroom["submissions"][0]["assignment_id"] == assignment_id
    assert classroom["submissions"][0]["status"] == "submitted"

    submission_id = classroom["submissions"][0]["id"]
    review_response = client.post(
        f"/api/teacher/classes/{section_id}/submissions/{submission_id}/review",
        json={
            "raw_score": 18,
            "percentage": 72,
            "feedback": "Needs support",
        },
    )
    assert review_response.status_code == 200
    assert review_response.get_json()["grade"]["percentage"] == 72.0
    assert review_response.get_json()["intervention_created"] is True
    assert review_response.get_json()["submission"]["final_score"] == 72.0

    reports_response = client.get("/api/teacher/reports")
    assert reports_response.status_code == 200
    report_summary = reports_response.get_json()["summary"]
    assert report_summary["classes"] == 1
    assert report_summary["modules"] == 1
    assert report_summary["published_assignments"] == 1

    filtered_reports_response = client.get(
        "/api/teacher/reports?submission_status=graded&student_query=student"
    )
    assert filtered_reports_response.status_code == 200
    assert filtered_reports_response.get_json()["summary"]["submissions"] == 1

    assignment_filtered_response = client.get(
        f"/api/teacher/reports?assignment_id={assignment_id}&min_percentage=70&max_percentage=75"
    )
    assert assignment_filtered_response.status_code == 200
    filtered_payload = assignment_filtered_response.get_json()
    assert filtered_payload["filters"]["assignment_id"] == assignment_id
    assert filtered_payload["submission_summaries"][0]["assignment_id"] == assignment_id
    assert filtered_payload["submission_summaries"][0]["final_score"] == 72.0

    export_response = client.get("/api/teacher/reports/export")
    assert export_response.status_code == 200
    assert export_response.headers["Content-Disposition"].endswith('teacher-reports.csv"')
    assert "section,student,assignment,score,percentage,remarks" in export_response.get_data(as_text=True)

    with app.app_context():
        assert Assignment.query.count() == 2
        assert Announcement.query.count() == 1
        assert AssignmentQuestion.query.count() == 1
        assert DiscussionThread.query.count() == 1
        assert DiscussionReply.query.count() == 1
        assert Grade.query.count() == 1
        graded_submission = Submission.query.first()
        assert graded_submission.status == "graded"


def test_teacher_profile_and_reports_include_records_and_submission_summaries():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        db.session.add(TeacherProfile(user_id=teacher.id, department="Math", phone="0917"))
        student = create_user("student", "student@example.com", "S-001")
        db.session.add(
            StudentProfile(
                user_id=student.id,
                grade_level="Grade 10",
                guardian_name="Guardian",
                guardian_contact="0912",
            )
        )
        section = Section(
            name="Section C",
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
        assignment = Assignment(
            section_id=section.id,
            teacher_user_id=teacher.id,
            title="Quiz Report",
            type="quiz",
            instructions="Solve",
            status="published",
        )
        db.session.add(assignment)
        db.session.flush()
        db.session.add(
            Enrollment(section_id=section.id, student_user_id=student.id, status="active")
        )
        db.session.add(
            Submission(
                assignment_id=assignment.id,
                student_user_id=student.id,
                submitted_at=datetime.now(UTC),
                status="graded",
                raw_score=20,
                final_score=80,
                feedback="Solid work",
                graded_at=datetime.now(UTC),
            )
        )
        db.session.add(
            Grade(
                section_id=section.id,
                assignment_id=assignment.id,
                student_user_id=student.id,
                score=20,
                percentage=80,
                remarks="Passing",
            )
        )
        db.session.add(
            Intervention(
                student_user_id=student.id,
                section_id=section.id,
                assignment_id=assignment.id,
                trigger_score=70,
                status="open",
                teacher_note="Monitor progress",
            )
        )
        db.session.commit()

    client = app.test_client()
    login_as(client, "teacher@example.com")

    profile_response = client.get("/api/teacher/profile")
    assert profile_response.status_code == 200
    assert profile_response.get_json()["profile"]["department"] == "Math"

    update_response = client.put(
        "/api/teacher/profile",
        json={
            "first_name": "Lead",
            "last_name": "Teacher",
            "school_id": "T-101",
            "email": "lead.teacher@example.com",
            "department": "STEM",
            "phone": "0998",
        },
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["profile"]["full_name"] == "Lead Teacher"

    password_response = client.post(
        "/api/teacher/profile/password",
        json={"current_password": "Test@123", "new_password": "Teacher456!"},
    )
    assert password_response.status_code == 200

    reports_response = client.get("/api/teacher/reports")
    assert reports_response.status_code == 200
    body = reports_response.get_json()
    assert body["summary"]["submissions"] == 1
    assert body["class_records"][0]["section_name"] == "Section C"
    assert body["class_records"][0]["students"][0]["grades"][0]["percentage"] == 80.0
    assert body["submission_summaries"][0]["feedback"] == "Solid work"
    assert body["intervention_list"][0]["status"] == "open"

    with app.app_context():
        refreshed = User.query.filter_by(email="lead.teacher@example.com").first()
        assert refreshed is not None
        assert refreshed.school_id == "T-101"
        assert refreshed.check_password("Teacher456!")
        profile = TeacherProfile.query.filter_by(user_id=refreshed.id).first()
        assert profile.department == "STEM"
        assert profile.phone == "0998"


def test_teacher_can_manage_calendar_and_resources():
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )

    with app.app_context():
        db.create_all()
        teacher = create_user("teacher", "teacher@example.com", "T-001")
        section = Section(
            name="Section D",
            grade_level="Grade 9",
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
                subject_name="Science",
            )
        )
        db.session.add(
            Resource(
                uploader_user_id=teacher.id,
                section_id=section.id,
                title="Shared Slides",
                category="PPT",
                file_path="/files/slides.pptx",
                visibility="section",
            )
        )
        db.session.add(
            CalendarEvent(
                title="Lab Day",
                section_id=section.id,
                start_at=datetime.now(UTC),
                event_type="lab",
                description="Bring goggles",
            )
        )
        db.session.commit()
        section_id = section.id

    client = app.test_client()
    login_as(client, "teacher@example.com")

    calendar_response = client.get("/api/teacher/calendar")
    assert calendar_response.status_code == 200
    assert calendar_response.get_json()["events"][0]["title"] == "Lab Day"

    create_event_response = client.post(
        "/api/teacher/calendar",
        json={
            "section_id": section_id,
            "title": "Quiz Review",
            "start_at": datetime.now(UTC).isoformat(),
            "event_type": "review",
            "description": "Bring notes",
        },
    )
    assert create_event_response.status_code == 201
    assert create_event_response.get_json()["event"]["title"] == "Quiz Review"
    event_id = create_event_response.get_json()["event"]["id"]

    update_event_response = client.put(
        f"/api/teacher/calendar/{event_id}",
        json={
            "title": "Quiz Review Updated",
            "event_type": "assessment",
            "description": "Bring reviewer and notes",
        },
    )
    assert update_event_response.status_code == 200
    assert update_event_response.get_json()["event"]["title"] == "Quiz Review Updated"

    resources_response = client.get("/api/teacher/resources")
    assert resources_response.status_code == 200
    assert resources_response.get_json()["resources"][0]["title"] == "Shared Slides"

    create_resource_response = client.post(
        "/api/teacher/resources",
        json={
            "section_id": section_id,
            "title": "Worksheet Pack",
            "category": "PDF",
            "file_path": "/files/worksheet-pack.pdf",
            "visibility": "section",
        },
    )
    assert create_resource_response.status_code == 201
    assert create_resource_response.get_json()["resource"]["title"] == "Worksheet Pack"
    resource_id = create_resource_response.get_json()["resource"]["id"]

    update_resource_response = client.put(
        f"/api/teacher/resources/{resource_id}",
        json={
            "title": "Worksheet Pack Revised",
            "visibility": "school",
        },
    )
    assert update_resource_response.status_code == 200
    assert update_resource_response.get_json()["resource"]["title"] == "Worksheet Pack Revised"

    with app.app_context():
        assert CalendarEvent.query.count() == 2
        assert Resource.query.count() == 2


def test_teacher_can_manage_roster_uploads_and_performance_views():
    with TemporaryDirectory() as tmp_dir:
        app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "MODULE_UPLOAD_DIR": tmp_dir,
                "RESOURCE_UPLOAD_DIR": tmp_dir,
            }
        )

        with app.app_context():
            db.create_all()
            teacher = create_user("teacher", "teacher@example.com", "T-001")
            enrolled_student = create_user("student", "enrolled@example.com", "S-001")
            eligible_student = create_user("student", "eligible@example.com", "S-002")
            db.session.add(StudentProfile(user_id=enrolled_student.id, grade_level="Grade 10"))
            db.session.add(StudentProfile(user_id=eligible_student.id, grade_level="Grade 10"))
            section = Section(
                name="Section E",
                grade_level="Grade 10",
                school_year="2026-2027",
                adviser_user_id=teacher.id,
                schedule_text="MWF 08:00-09:00",
                status="active",
            )
            db.session.add(section)
            db.session.flush()
            db.session.add(
                SectionTeacher(
                    section_id=section.id,
                    teacher_user_id=teacher.id,
                    subject_name="English",
                )
            )
            db.session.add(
                Enrollment(section_id=section.id, student_user_id=enrolled_student.id, status="active")
            )
            assignment = Assignment(
                section_id=section.id,
                teacher_user_id=teacher.id,
                title="Essay 1",
                type="written_work",
                instructions="Write the draft.",
                status="published",
            )
            db.session.add(assignment)
            db.session.flush()
            db.session.add(
                Grade(
                    section_id=section.id,
                    assignment_id=assignment.id,
                    student_user_id=enrolled_student.id,
                    score=14,
                    percentage=70,
                    remarks="Needs support",
                )
            )
            db.session.add(
                Intervention(
                    student_user_id=enrolled_student.id,
                    section_id=section.id,
                    assignment_id=assignment.id,
                    trigger_score=70,
                    status="open",
                    teacher_note="Needs writing support",
                )
            )
            db.session.commit()
            section_id = section.id
            eligible_student_id = eligible_student.id

        client = app.test_client()
        login_as(client, "teacher@example.com")

        roster_response = client.get("/api/teacher/roster")
        assert roster_response.status_code == 200
        assert roster_response.get_json()["sections"][0]["students"][0]["email"] == "enrolled@example.com"

        class_roster_response = client.get(f"/api/teacher/classes/{section_id}/roster")
        assert class_roster_response.status_code == 200
        assert class_roster_response.get_json()["section"]["schedule_text"] == "MWF 08:00-09:00"
        assert any(
            item["id"] == eligible_student_id
            for item in class_roster_response.get_json()["eligible_students"]
        )

        add_student_response = client.post(
            f"/api/teacher/classes/{section_id}/roster",
            json={"student_user_id": eligible_student_id},
        )
        assert add_student_response.status_code == 201
        assert add_student_response.get_json()["student"]["email"] == "eligible@example.com"

        upload_response = client.post(
            "/api/teacher/uploads",
            data={
                "kind": "module",
                "file": (BytesIO(b"sample module"), "module.pdf"),
            },
            content_type="multipart/form-data",
        )
        assert upload_response.status_code == 201
        assert upload_response.get_json()["file_path"].endswith("module.pdf")

        records_response = client.get("/api/teacher/records")
        assert records_response.status_code == 200
        assert records_response.get_json()["class_records"][0]["students"][0]["grades"][0]["percentage"] == 70.0

        performance_response = client.get("/api/teacher/performance")
        assert performance_response.status_code == 200
        body = performance_response.get_json()
        assert body["section_summaries"][0]["schedule_text"] == "MWF 08:00-09:00"
        assert body["low_scorers"][0]["percentage"] == 70.0
        assert body["assignment_trends"][0]["assignment_title"] == "Essay 1"
