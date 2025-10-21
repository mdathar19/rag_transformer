# API Structure - User & Admin Separation

## Overview
The API now has three distinct route modules:
1. **Common Routes** - Authentication and shared functionality
2. **User Routes** - For regular users (auto-filtered by owner)
3. **Admin Routes** - For admin users (full access)

## Base URL
```
http://localhost:5000/api/v1
```

## Route Structure

### 1. Common Routes (`/api/v1`)

#### Authentication (Public - No Auth Required)
```
POST /auth/request-login-otp
POST /auth/request-signup-otp
POST /auth/verify-login-otp
POST /auth/verify-signup-otp
```

#### User Profile (Protected - JWT Required)
```
GET  /auth/verify
POST /auth/refresh
GET  /auth/profile
PUT  /auth/profile
POST /auth/api-key
```

#### Legacy Client Routes (Backward Compatibility)
```
GET    /clients          # Auto-filters by user type
POST   /clients          # Adds owner automatically
GET    /clients/:brokerId
PUT    /clients/:brokerId
DELETE /clients/:brokerId
POST   /crawl
GET    /crawl/:jobId/status
```

### 2. User Routes (`/api/v1/user`)
**Access:** Regular users only
**Authentication:** JWT required (automatically applied)
**Filtering:** All data automatically filtered by owner (user's brokerId)

#### Websites
```
GET    /user/websites              # List user's own websites
POST   /user/websites              # Create website (owner auto-assigned)
GET    /user/websites/:brokerId    # Get specific website (ownership verified)
PUT    /user/websites/:brokerId    # Update website (ownership verified)
DELETE /user/websites/:brokerId    # Delete website (ownership verified)
GET    /user/websites/:brokerId/stats
```

#### Crawling
```
POST /user/crawl                  # Start crawl (ownership verified)
GET  /user/crawl/:jobId/status    # Get crawl status
```

#### Query & Chat
```
POST   /user/query                # Query website (ownership verified)
POST   /user/chat                 # Chat with website
GET    /user/chat/session/:sessionId
DELETE /user/chat/session/:sessionId
POST   /user/session/new
```

#### Dashboard
```
GET /user/dashboard/stats         # User-specific stats
```

### 3. Admin Routes (`/api/v1/admin`)
**Access:** Admin users only (userType: 'ADMIN')
**Authentication:** JWT required + Admin role check
**Filtering:** No filtering - full access to all data

#### Websites
```
GET    /admin/websites              # List ALL websites
POST   /admin/websites              # Create any website
GET    /admin/websites/:brokerId    # Get any website
PUT    /admin/websites/:brokerId    # Update any website
DELETE /admin/websites/:brokerId    # Delete any website
GET    /admin/websites/:brokerId/stats
PUT    /admin/websites/:brokerId/no-answer-response
```

#### User Management
```
GET    /admin/users                 # List all users
GET    /admin/users/:brokerId       # Get specific user
PUT    /admin/users/:brokerId       # Update user
DELETE /admin/users/:brokerId       # Delete user
```

#### Crawling
```
POST /admin/crawl                   # Start crawl for any website
POST /admin/crawl/batch             # Batch crawl multiple websites
GET  /admin/crawl/:jobId/status     # Get crawl status
```

#### Query & Chat
```
POST /admin/query                   # Query any website
POST /admin/chat                    # Chat with any website
```

#### Analytics & Content
```
GET    /admin/analytics/:brokerId   # Get analytics for any website
GET    /admin/content/:brokerId     # Get content for any website
DELETE /admin/content/:brokerId/:contentId
```

#### Cache Management
```
POST /admin/cache/clear             # Clear cache for specific broker
GET  /admin/cache/stats             # Get cache statistics
```

#### Dashboard
```
GET /admin/dashboard/stats          # System-wide statistics
```

## Authentication

### JWT Token Structure
```json
{
  "brokerId": "USER123ABC",
  "email": "user@example.com",
  "userType": "USER" | "ADMIN",
  "companyName": "Company Name"
}
```

### Headers
All protected routes require:
```
Authorization: Bearer <JWT_TOKEN>
```

## Request/Response Examples

### User Creates Website
**Request:**
```http
POST /api/v1/user/websites
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "name": "My Company Website",
  "domain": "https://mycompany.com",
  "metadata": {
    "description": "Company main website"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "brokerId": "MYCO1234567890AB",
    "name": "My Company Website",
    "domain": "https://mycompany.com",
    "owner": "USER123ABC",              // Auto-assigned
    "ownerEmail": "user@example.com",   // Auto-assigned
    "status": "active",
    "createdAt": "2025-01-20T10:00:00Z"
  },
  "message": "Website added successfully"
}
```

### User Lists Websites
**Request:**
```http
GET /api/v1/user/websites
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "brokerId": "MYCO1234567890AB",
        "name": "My Company Website",
        "domain": "https://mycompany.com",
        "owner": "USER123ABC",           // Only shows user's own websites
        "ownerEmail": "user@example.com",
        "contentCount": 42,
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

### Admin Lists All Websites
**Request:**
```http
GET /api/v1/admin/websites
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "brokerId": "MYCO1234567890AB",
        "name": "My Company Website",
        "owner": "USER123ABC",
        "ownerEmail": "user@example.com",
        "contentCount": 42
      },
      {
        "brokerId": "ACME9876543210XY",
        "name": "Acme Corp",
        "owner": "USER456DEF",           // Different owner
        "ownerEmail": "admin@acme.com",
        "contentCount": 156
      }
      // ... all websites from all users
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized. Please provide a valid token."
}
```

### 403 Forbidden (Admin Route)
```json
{
  "success": false,
  "error": "Access denied. Admin privileges required."
}
```

### 403 Forbidden (Ownership)
```json
{
  "success": false,
  "error": "Access denied. You do not own this website."
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Client with broker ID ABC123 not found"
}
```

## Middleware

### authenticateJWT
- Validates JWT token
- Extracts user information from token
- Sets `req.user` with: `{ brokerId, email, userType, companyName }`
- Applied to all protected routes

### requireAdmin
- Checks if `req.user.userType === 'ADMIN'`
- Returns 403 if not admin
- Applied to all `/admin/*` routes

### Auto-Ownership Filter (User Routes)
```javascript
// Automatically applied in user routes
filters.owner = req.user.brokerId;
```

### Auto-Owner Assignment (User Create)
```javascript
// Automatically applied when user creates website
const clientData = {
  ...req.body,
  owner: req.user.brokerId,
  ownerEmail: req.user.email
};
```

## Migration from Old API

### Old Way (Everything in /clients)
```javascript
// Had to manually check user type and filter
GET /api/v1/clients
// Response varied based on user type
```

### New Way (Separate Routes)
```javascript
// User route - automatically filtered
GET /api/v1/user/websites
// Always returns only user's websites

// Admin route - full access
GET /api/v1/admin/websites
// Always returns all websites
```

## Benefits

1. **Clear Separation:** User and admin routes are completely separate
2. **Automatic Filtering:** User routes automatically filter by owner
3. **Automatic Ownership:** User creates automatically assign owner
4. **Security:** Ownership verified at route level
5. **Maintainability:** Each route file handles its own logic
6. **Backward Compatibility:** Legacy /clients routes still work

## Testing

### Test User Routes
```bash
# Login as regular user
curl -X POST http://localhost:5000/api/v1/auth/verify-login-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@test.com", "otp": "123456"}'

# Get token from response, then:
curl -X GET http://localhost:5000/api/v1/user/websites \
  -H "Authorization: Bearer <USER_TOKEN>"

# Should only see user's own websites
```

### Test Admin Routes
```bash
# Login as admin
curl -X POST http://localhost:5000/api/v1/auth/verify-login-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "otp": "123456"}'

# Get token from response, then:
curl -X GET http://localhost:5000/api/v1/admin/websites \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Should see ALL websites from ALL users
```

### Test Access Control
```bash
# Try to access admin route with user token
curl -X GET http://localhost:5000/api/v1/admin/websites \
  -H "Authorization: Bearer <USER_TOKEN>"

# Should get: 403 Forbidden - Admin privileges required
```

## File Structure

```
src/api/
├── routes.js           # Main router, common routes, legacy routes
├── userRoutes.js       # User-specific routes
└── adminRoutes.js      # Admin-specific routes
```
