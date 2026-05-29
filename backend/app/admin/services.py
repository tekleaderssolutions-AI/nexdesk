import secrets
import string
from typing import Optional
from sqlalchemy.orm import Session
from app.models import User, Department, Organization
from app.core.security import hash_password


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password."""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(characters) for _ in range(length))


def create_user(
    db: Session,
    full_name: str,
    email: str,
    phone: Optional[str],
    department_id,
    organization_id,
    role: str,
    created_by_user_id,
) -> tuple:
    """Create a new user with temporary password."""
    # Check if email already exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError(f"Email {email} already exists")

    # Generate temp password
    temp_password = generate_temporary_password()
    password_hash = hash_password(temp_password)

    # Create user
    user = User(
        full_name=full_name,
        email=email,
        password_hash=password_hash,
        phone=phone,
        department_id=department_id,
        organization_id=organization_id,
        role=role.upper(),
        is_temp_password=True,
        is_active=True,
        created_by=created_by_user_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user, temp_password


def reset_user_password(db: Session, user_id) -> tuple:
    """Reset user password and return temporary password."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")

    temp_password = generate_temporary_password()
    user.password_hash = hash_password(temp_password)
    user.is_temp_password = True
    db.commit()
    db.refresh(user)

    return user, temp_password


def get_users(db: Session, skip: int = 0, limit: int = 100):
    """Get all users with pagination."""
    return db.query(User).offset(skip).limit(limit).all()


def get_user_by_id(db: Session, user_id):
    """Get a user by ID."""
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_by_email(db: Session, email: str):
    """Get a user by email."""
    return db.query(User).filter(User.email == email).first()


def update_user(db: Session, user_id, full_name=None, phone=None, department_id=None, role=None):
    """Update user information."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")

    if full_name is not None:
        user.full_name = full_name
    if phone is not None:
        user.phone = phone
    if department_id is not None:
        user.department_id = department_id
    if role is not None:
        user.role = role.upper()

    db.commit()
    db.refresh(user)
    return user


def activate_user(db: Session, user_id):
    """Activate a user."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")

    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user_id):
    """Deactivate a user."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")

    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


def get_departments(db: Session, skip: int = 0, limit: int = 100):
    """Get all departments with pagination."""
    return db.query(Department).offset(skip).limit(limit).all()


def get_department_by_id(db: Session, department_id):
    """Get a department by ID."""
    return db.query(Department).filter(Department.id == department_id).first()


def create_department(db: Session, organization_id, department_name: str):
    """Create a new department."""
    dept = Department(
        organization_id=organization_id,
        department_name=department_name,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept
