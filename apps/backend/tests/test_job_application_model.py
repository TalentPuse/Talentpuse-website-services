from app.models.job_application import JobApplication, APPLICATION_STATUSES


def test_status_enum_values():
    assert APPLICATION_STATUSES == ("saved", "applied", "interviewing", "offer", "rejected")


def test_table_name_and_schema():
    assert JobApplication.__tablename__ == "job_applications"
    assert JobApplication.__table_args__[-1] == {"schema": "app"}


def test_columns_exist():
    cols = set(JobApplication.__table__.columns.keys())
    assert {
        "id", "user_id", "source", "source_job_id", "title", "company_name",
        "city", "source_url", "salary_million", "status", "applied_at",
        "notes", "created_at", "updated_at",
    } <= cols
