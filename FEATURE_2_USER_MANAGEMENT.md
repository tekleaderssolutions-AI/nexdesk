# FEATURE 2 — USER MANAGEMENT

## Overview

Feature 2 provides complete user administration capabilities for the NexDesk platform. Only **ADMIN** users can access user management functions. TEAM and USER roles cannot access any user management features.

## Architecture

### Backend

The backend provides a complete REST API for user and department management with RBAC protection via `@Depends(get_current_admin)` on all endpoints.

**API Endpoints:**

- `GET /admin/users` — List all users
- `GET /admin/users/{user_id}` — Get user details
- `POST /admin/users` — Create new user with temporary password
- `PUT /admin/users/{user_id}` — Update user information
- `PUT /admin/users/{user_id}/activate` — Activate user
- `PUT /admin/users/{user_id}/deactivate` — Deactivate user
- `PUT /admin/users/{user_id}/reset-password` — Reset password with new temporary password
- `GET /admin/departments` — List departments
- `GET /admin/departments/{department_id}` — Get department
- `POST /admin/departments` — Create department

### Frontend

**Admin Pages:**

- `/admin/users` — User list with filters (role, status, department, search)
- `/admin/users/create` — Create new user form
- `/admin/users/:userId` — Edit user and reset password

### Database

Utilizes existing tables:

- `users` — Stores user accounts with `is_active` and `is_temp_password` flags
- `departments` — Department information
- `organizations` — Organization/tenant data

## Features

### 1. Create User

Admin enters:
- Full Name
- Email (must be unique)
- Phone
- Department
- Role (USER, TEAM, or ADMIN)

Backend automatically:
- Generates secure temporary password
- Hashes password with bcrypt
- Sets `is_temp_password = TRUE`
- Returns user with temporary password

### 2. User List with Filtering

Admin can view all users with:
- **Filters:** Role (USER/TEAM/ADMIN), Status (Active/Inactive), Department
- **Search:** By name or email
- **Actions:** Edit, Activate, Deactivate

### 3. Edit User

Admin can modify:
- Full Name
- Phone
- Department
- Role

Cannot modify:
- `user_id` (primary key)
- Email (shown but disabled)

### 4. Password Reset

Admin clicks "Reset Password" on user detail page:
- Backend generates new temporary password
- Sets `is_temp_password = TRUE`
- Returns temporary password to admin

User on next login will be forced to change password.

### 5. Activate / Deactivate Users

Instead of deleting users:
- Set `is_active = FALSE` to deactivate
- Set `is_active = TRUE` to activate

**Benefits:**
- Preserves audit trail
- Maintains ticket history
- Allows re-activation

### 6. Department Management

Admins can:
- View all departments
- Create new departments

## File Structure

```
backend/
  app/
    admin/
      __init__.py         # Module exports
      schemas.py          # Pydantic models for requests/responses
      services.py         # Business logic (create user, reset password, etc.)
      routes.py           # FastAPI routes (admin-only)

frontend/
  src/
    services/
      adminService.js     # API client for admin endpoints
    pages/
      admin/
        AdminUserList.jsx  # User list with filters
        AdminUserForm.jsx  # Create/edit user form
```

## RBAC Protection

### Backend

All admin endpoints require `@Depends(get_current_admin)`:

```python
@router.get("/admin/users")
def list_users(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    # Only ADMIN can access
```

If `current_admin.role != 'ADMIN'`, FastAPI returns `403 Forbidden`.

### Frontend

Admin routes check role on client:

```javascript
<Route
  path="/admin/users"
  element={
    <RoleProtectedRoute allowedRoles={['ADMIN']}>
      <AdminUserList />
    </RoleProtectedRoute>
  }
/>
```

Non-admin users attempting `/admin/users` are redirected to their role dashboard.

## User Creation Workflow

### Step 1: Admin creates user

```javascript
POST /admin/users
{
  "full_name": "John Doe",
  "email": "john@company.com",
  "phone": "+1 (555) 123-4567",
  "role": "USER",
  "department_id": "uuid-of-dept",
  "organization_id": "uuid-of-org"
}
```

### Step 2: Backend response

```json
{
  "user_id": "uuid-of-user",
  "email": "john@company.com",
  "full_name": "John Doe",
  "role": "USER",
  "is_active": true,
  "is_temp_password": true,
  "created_at": "2026-05-29T10:00:00Z",
  "temporary_password": "AbC123!@#XyZ"
}
```

Admin shares temporary password with user via secure channel.

### Step 3: User logs in

User logs in with email and temporary password. Frontend detects `is_temp_password = TRUE` and forces password change (Future: Feature 3).

## Password Reset Workflow

### Step 1: Admin initiates reset

```javascript
PUT /admin/users/{user_id}/reset-password
```

### Step 2: Backend generates new temp password

```json
{
  "user_id": "uuid-of-user",
  "temporary_password": "NewTemp456!@#",
  "message": "Password reset for john@company.com. User must change password on next login."
}
```

### Step 3: Admin shares with user

User logs in with new temporary password and must change it on first login.

## API Examples

### List Users

```bash
curl -X GET http://127.0.0.1:8000/admin/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Create User

```bash
curl -X POST http://127.0.0.1:8000/admin/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Smith",
    "email": "jane@company.com",
    "phone": "+1 (555) 987-6543",
    "role": "TEAM",
    "department_id": "uuid-of-dept"
  }'
```

### Reset Password

```bash
curl -X PUT http://127.0.0.1:8000/admin/users/{user_id}/reset-password \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Deactivate User

```bash
curl -X PUT http://127.0.0.1:8000/admin/users/{user_id}/deactivate \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## Testing

### Step 1: Start Backend

```bash
cd backend
uvicorn app.main:app --reload
```

### Step 2: Start Frontend

```bash
cd frontend
npm run dev
# or
yarn dev
```

### Step 3: Login as Admin

1. Open http://localhost:5173/login (or 3000)
2. Select "Admin" role
3. Log in with admin credentials
4. Navigate to `/admin/users`

### Step 4: Create a Test User

1. Click "+ Create User"
2. Fill form with:
   - Full Name: "Test User"
   - Email: "test@example.com"
   - Role: "USER"
3. Click "Create User"
4. Copy temporary password

### Step 5: Verify User List

1. Return to `/admin/users`
2. See new user in list
3. Click "Edit" to verify details
4. Test "Reset Password" button

### Step 6: Test Non-Admin Access

1. Log out
2. Log in as USER or TEAM
3. Try to access `/admin/users`
4. Should be redirected to their role dashboard

## Output Status

✅ Organization hierarchy (organizations table)
✅ Departments (departments table)
✅ User administration (create, edit, deactivate, activate)
✅ Team administration (create, assign)
✅ Password reset with temporary passwords
✅ User activation/deactivation (soft delete)
✅ Admin user management dashboard
✅ RBAC enforcement (ADMIN-only access)

## Next Steps

**Feature 3 — Ticket Management** will build on top of Feature 2 by:
- Allowing users to create tickets
- Allowing team members to manage tickets
- Implementing SLA tracking
- Adding AI-powered ticket routing

## Security Considerations

1. **Password Hashing:** All passwords hashed with bcrypt (12 rounds)
2. **Temporary Passwords:** Generated using `secrets` module (cryptographically secure)
3. **RBAC:** Protected at both frontend and backend
4. **Email Unique:** Enforced at database level
5. **Audit Trail:** `created_by`, `created_at`, `updated_at` timestamps
6. **Soft Delete:** Users marked `is_active = FALSE` instead of hard delete

## Common Issues

### Issue: Backend returns 403 Forbidden for /admin/users

**Cause:** Token belongs to non-admin user or token is invalid

**Solution:** Ensure logged-in user has `role = 'ADMIN'` and token is valid

### Issue: Frontend redirects from /admin/users to /user/dashboard

**Cause:** Client-side role check failed (user is not ADMIN)

**Solution:** Create/login as ADMIN user

### Issue: "Email already exists" error

**Cause:** Email is already used in database

**Solution:** Use unique email address or use different format (e.g., add number suffix)

---

**Feature 2 is complete and ready for Feature 3 — Ticket Management.**
