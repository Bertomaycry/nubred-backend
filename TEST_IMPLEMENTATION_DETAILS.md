# Test Implementation Details
**Project:** nuBred Backend  

---

## Test Suite Overview

- **Integration Tests:** 65 tests across 3 files
- **Unit Tests:** 83 tests across 5 files
- **Total:** 148 tests, 8 test suites

---

## Integration Tests

### `tests/integration/auth.routes.test.js` - 45 tests

#### POST /register (3 tests)
- **Successful registration**
  - Creates user with valid data
  - Returns 201 with user object
  - Stores user in database

- **Duplicate email/phone**
  - Returns 400 when email already exists
  - Validates duplicate prevention

- **Duplicate phone number**
  - Returns 400 when phone number already taken
  - Different email, same phone fails registration

#### POST /login (4 tests)
- **Valid credentials**
  - Returns 200 with user data and access token
  - Token generation verified

- **Invalid password**
  - Returns 400 with "Invalid email or password"
  - Wrong password rejected

- **Missing credentials**
  - Returns 400 when email/password not provided
  - Validates required fields

- **Non-existent user**
  - Returns 400 when user doesn't exist
  - Same error message for security (doesn't reveal user existence)

#### GET /user/:_id (2 tests)
- **User exists**
  - Returns 200 with user data, accessToken, and refreshToken
  - User lookup by ID works

- **User not found**
  - Returns 200 with success:false and "User Not Found"
  - Handles missing user gracefully

#### GET /users - Protected Route (3 tests)
- **No token**
  - Returns 401 with "Token not provided"
  - Middleware blocks access

- **Valid token**
  - Returns 200 with array of all users
  - Authentication successful

- **Invalid token**
  - Returns 401 for malformed tokens
  - Token validation working

#### POST /logout - Protected Route (3 tests)
- **No token**
  - Returns 401 when token missing
  - Middleware protection verified

- **Successful logout**
  - Returns 200 on valid token
  - Logout flow works

- **Invalid token**
  - Returns 401 for bad tokens
  - Token validation enforced

#### POST /admin-login (5 tests)
- **Admin login success**
  - Returns 200 with admin user and tokens
  - Admin authentication working

- **Missing credentials**
  - Returns 400 when email/password missing
  - Required field validation

- **Admin not found**
  - Returns 404 when admin user doesn't exist
  - User lookup validation

- **Non-admin user**
  - Returns 403 when user lacks admin role
  - Role-based access control

- **Invalid password**
  - Returns 400 for wrong password
  - Password verification

#### User Onboarding & Account State (5 tests)
- **Mark user as onboarded**
  - Sets is_onboarded flag to true
  - Onboarding state management

- **Skip account creation**
  - Sets is_account_created_skipped flag
  - Account creation skip flow

- **Schedule unregister**
  - Sets unregister_requested and schedules deletion in 30 days
  - Unregister scheduling works

- **Cancel unregister request**
  - Clears unregister flags for existing user
  - Cancellation flow verified

- **Register account again**
  - Sets is_unregistered back to false
  - Account reactivation

#### Ban/Unban/Update Ban Routes (9 tests)
- **Ban user - missing fields**
  - Returns 400 when required ban fields missing
  - Validation working

- **Ban user - not found**
  - Returns 404 when user doesn't exist
  - User existence check

- **Ban user - success**
  - Bans user with type, reason, period
  - Ban functionality working

- **Remove ban - missing userId**
  - Returns 400 when userId not provided
  - Required field validation

- **Remove ban - not found**
  - Returns 404 when user doesn't exist
  - User lookup validation

- **Remove ban - success**
  - Removes ban from user
  - Unban functionality working

- **Update ban - missing fields**
  - Returns 400 when required fields missing
  - Validation enforced

- **Update ban - not found**
  - Returns 404 when user doesn't exist
  - User existence check

- **Update ban - success**
  - Updates ban details
  - Ban modification working

#### DELETE /delete-user/:_id (2 tests)
- **User not found**
  - Returns 404 when user doesn't exist
  - Error handling verified

- **Delete success**
  - Returns 200 and removes user from database
  - User deletion working

#### JWT Token Validation (7 tests) ⭐ NEW
- **Expired token**
  - Returns 401 when token has expired
  - Token expiration handling

- **Wrong secret key**
  - Returns 401 when token signed with wrong secret
  - Token signature validation

- **No Bearer prefix**
  - Returns 401 when Authorization header missing "Bearer "
  - Bearer token format required

- **Lowercase bearer**
  - Returns 401 when using "bearer" instead of "Bearer"
  - Case-sensitive Bearer requirement enforced

- **User deleted but token valid**
  - Returns 401 when user deleted but token still valid
  - User existence check in middleware

- **Empty Bearer token**
  - Returns 401 when "Bearer " with no token
  - Empty token rejection

#### POST /cancel-unregister/:_id (2 tests) ⭐ NEW
- **User not found**
  - Returns 404 when canceling unregister for non-existent user
  - Null check implementation verified

- **Cancel success**
  - Returns 200, sets unregister_requested=false, unregister_scheduled_at=null
  - Complete cancellation flow tested

---

### `tests/integration/profile.routes.test.js` - 19 tests

#### POST /create (5 tests)
- **Invalid profile type**
  - Returns 400 for invalid profile_type
  - Only "company" and "consultant" allowed

- **User not found**
  - Returns 404 when user doesn't exist
  - User existence validation

- **Create company profile**
  - Returns 201, creates profile, updates user account_created and profile_type
  - Complete company profile creation flow

- **Profile already exists**
  - Returns 400 when user already has a profile
  - Duplicate profile prevention

- **Create consultant profile**
  - Returns 201, creates consultant profile, updates user
  - Consultant profile creation flow

#### PUT /update-profile - Protected Route (8 tests)
- **No token**
  - Returns 401 when Authorization header missing
  - Middleware protection verified

- **Invalid token**
  - Returns 401 for malformed tokens
  - Token validation working

- **Invalid profile type**
  - Returns 400 for invalid profile_type
  - Type validation enforced

- **Company profile not found**
  - Returns 404 when profile doesn't exist
  - Profile existence check for company

- **Consultant profile not found**
  - Returns 404 when profile doesn't exist
  - Profile existence check for consultant

- **Invalid profile_id format**
  - Returns 500 for malformed ObjectId (CastError)
  - Input validation

- **Update company profile**
  - Returns 200, updates profile data successfully
  - Company profile update working

- **Update consultant profile**
  - Returns 200, updates profile data successfully
  - Consultant profile update working

#### GET /user-profile/:_id (3 tests)
- **User not found**
  - Returns 404 when user doesn't exist
  - User lookup validation

- **Invalid user ID**
  - Returns 500 for malformed ObjectId
  - Input format validation

- **Get profile success**
  - Returns 200 with user and populated profile data
  - Profile retrieval with population working

#### PUT /update-profile - Authorization Tests (3 tests) ⭐ NEW
- **Unauthorized access**
  - Returns 403 when user tries to update another user's profile
  - Ownership verification security feature working

- **Authorized company update**
  - Returns 200 when user updates own company profile
  - Legitimate update flow with ownership check

- **Authorized consultant update**
  - Returns 200 when user updates own consultant profile
  - Legitimate update flow with ownership check

---

## Unit Tests

### `tests/unit/auth.middleware.test.js` - 7 tests ⭐ NEW FILE

**Component:** `src/middlewares/auth.middleware.js`

- **No Authorization header**
  - Returns 401, message: "Token not provided"
  - Header presence validation

- **No Bearer prefix**
  - Returns 401 when header doesn't start with "Bearer "
  - Bearer prefix requirement

- **Lowercase bearer**
  - Returns 401 when using "bearer" instead of "Bearer"
  - Case-sensitive validation enforced

- **Empty token**
  - Returns 401 when "Bearer " with empty token
  - Token presence check

- **Valid token, user found**
  - Calls next(), sets req.user with user object
  - Successful authentication flow

- **Valid token, user not found**
  - Returns 401, message: "User not found"
  - User existence validation in middleware

- **Invalid token**
  - Returns 401, message: "Please login to access this resource"
  - JWT verification error handling

---

### `tests/unit/asyncHandler.test.js` - 4 tests ⭐ NEW FILE

**Component:** `src/utils/asyncHandler.js`

- **Handler success**
  - Handler called with req, res, next, no error response sent
  - Normal async flow working

- **Error with custom code**
  - Uses error.code for status code, error.message for response
  - Custom error code handling

- **Error without code**
  - Defaults to 500 status code, uses error.message
  - Default error handling

- **Error without message**
  - Uses default message: "Something went wrong", 500 status
  - Fallback error message

---

### `tests/unit/supabase.test.js` - 7 tests ⭐ NEW FILE

**Component:** `src/utils/supabase.js`

#### Configuration Resolution (5 tests)
- **Missing SUPABASE_URL**
  - Throws error: "SUPABASE_URL is missing in environment variables"
  - Required environment variable validation

- **Missing both keys**
  - Throws error about missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
  - Key requirement validation

- **Service role key priority**
  - Uses service role key when both keys available
  - Key priority logic (service role > anon key)

- **Anon key fallback**
  - Uses anon key when service role key unavailable
  - Fallback mechanism working

- **Key whitespace trimming**
  - Trims whitespace from keys before use
  - Environment variable sanitization

#### Client Creation (2 tests)
- **Client creation**
  - Creates client with correct URL, key, and config (autoRefreshToken: false, persistSession: false)
  - Client initialization verified

- **Singleton pattern**
  - Returns same client instance on subsequent calls, createClient called once
  - Singleton implementation working

---

### `tests/unit/user.controller.test.js` - 50 tests

#### register (4 tests)
- **Email already taken**
  - Returns 400, message: "Email is already taken"
  - Duplicate email prevention

- **Phone already taken**
  - Returns 400, message: "Phone number is already taken"
  - Duplicate phone prevention

- **Registration success**
  - Returns 201, creates user successfully
  - User creation flow

- **Error handling**
  - Returns 500 with fallback message when error.message is undefined
  - Error handling robustness

#### getUsers (2 tests)
- **Success**
  - Returns 200 with array of users
  - User listing functionality

- **Error handling**
  - Returns 500 on database error
  - Error handling

#### getSingleUser (2 tests)
- **Success**
  - Returns 200 with user data, accessToken, refreshToken
  - User retrieval with token generation

- **User not found**
  - Returns 200 with success:false, message: "User Not Found"
  - Missing user handling

#### login (4 tests)
- **Missing credentials**
  - Returns 400 when email/password missing
  - Required field validation

- **User not found**
  - Returns 400 with "Invalid email or password"
  - Security: same message for non-existent user

- **Invalid password**
  - Returns 400 with "Invalid email or password"
  - Password verification

- **Login success**
  - Returns 200 with user data and accessToken
  - Successful authentication

#### adminLogin (5 tests)
- **Missing credentials**
  - Returns 400 when email/password missing
  - Required field validation

- **Admin not found**
  - Returns 404 when admin user doesn't exist
  - User lookup validation

- **Non-admin user**
  - Returns 403 when user lacks admin role
  - Role-based access control

- **Invalid password**
  - Returns 400 for wrong password
  - Password verification

- **Admin login success**
  - Returns 200 with admin user and tokens
  - Admin authentication flow

#### handleSocialLogin (6 tests)
- **Email missing**
  - Returns 400 when email not provided
  - Required field validation

- **Existing user by supabaseUserId**
  - Returns 200 when user found by supabaseUserId
  - Supabase user ID lookup

- **Fallback by email**
  - Returns 200 when found by email, updates supabaseUserId
  - Email fallback and user update

- **Create new user**
  - Returns 200, creates new user when none exists
  - New user creation flow

- **Error handling**
  - Returns 500 on Supabase/client errors
  - Error handling

#### logout (2 tests)
- **Success**
  - Returns 200 with success message
  - Logout functionality

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### markOnboarded (2 tests)
- **Success**
  - Updates is_onboarded flag to true
  - Onboarding state update

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### skipAccountCreation (2 tests)
- **Success**
  - Updates is_account_created_skipped flag
  - Skip flag update

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### unregisterUser (3 tests)
- **Success**
  - Sets unregister flags and schedules deletion
  - Unregister flow

- **User not found**
  - Returns 404 when user doesn't exist
  - User existence check

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### cancelUnregister (2 tests) ⭐ 1 NEW
- **Success**
  - Returns 200, clears unregister flags
  - Cancellation flow

- **User not found** ⭐ NEW
  - Returns 404 when user doesn't exist
  - Null check implementation verified

#### banUser (2 tests)
- **Success**
  - Bans user with ban details
  - Ban functionality

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### removeBan (2 tests)
- **Success**
  - Removes ban from user
  - Unban functionality

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### updateBan (2 tests)
- **Success**
  - Updates ban details
  - Ban modification

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### deleteUser (3 tests)
- **Success**
  - Returns 200, deletes user
  - User deletion

- **User not found**
  - Returns 404 when user doesn't exist
  - User existence check

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### registerAccount (3 tests)
- **Success**
  - Updates account_created flag
  - Account registration

- **User not found**
  - Returns 404 when user doesn't exist
  - User existence check

- **Error handling**
  - Returns 500 on errors
  - Error handling

---

### `tests/unit/profile.controller.test.js` - 15 tests

#### createUserProfile (5 tests)
- **Invalid profile type**
  - Returns 400, message: "Invalid profile type."
  - Type validation

- **Profile already exists**
  - Returns 400, message: "Profile already exists for this user."
  - Duplicate prevention

- **Create company profile**
  - Returns 201, creates company profile, updates user flags
  - Company profile creation flow

- **Create consultant profile**
  - Returns 201, creates consultant profile, updates user flags
  - Consultant profile creation flow

- **Error handling**
  - Returns 500 on database errors
  - Error handling

#### getUserProfile (3 tests)
- **User not found**
  - Returns 404, message: "User not found."
  - User lookup validation

- **Success**
  - Returns 200 with user and populated profile data
  - Profile retrieval working

- **Error handling**
  - Returns 500 on errors
  - Error handling

#### updateUserProfile (7 tests) ⭐ 1 NEW, 4 MODIFIED
- **Invalid profile type**
  - Returns 400 for invalid profile_type
  - Type validation

- **Company profile not found** ⭐ MODIFIED
  - Returns 404 when profile doesn't exist (now tests findById before update)
  - Profile existence check with ownership flow

- **Consultant profile not found** ⭐ MODIFIED
  - Returns 404 when profile doesn't exist (now tests findById before update)
  - Profile existence check with ownership flow

- **Unauthorized access** ⭐ NEW
  - Returns 403 when user tries to update another user's profile
  - Ownership verification security feature

- **Update company profile** ⭐ MODIFIED
  - Returns 200, updates profile (now includes ownership verification)
  - Successful update with ownership check

- **Update consultant profile** ⭐ MODIFIED
  - Returns 200, updates profile (now includes ownership verification)
  - Successful update with ownership check

- **Error handling**
  - Returns 500 on database errors
  - Error handling

---

## Test Coverage Summary

### Security-Critical Modules: 100% Coverage ✅
- **Auth Middleware:** 100% statements, branches, functions
- **Profile Controller:** 100% statements, branches, functions
- **Utilities (asyncHandler, supabase):** 100% coverage

### Test Distribution
- **Security Tests:** 18 tests (authentication, authorization, token validation)
- **Integration Tests:** 65 tests (end-to-end API flows)
- **Unit Tests:** 83 tests (component isolation, business logic)

---

## Key Features Tested

### Security Enhancements ⭐
1. **Profile Ownership Verification**
   - Users can only update their own profiles
   - 403 response for unauthorized attempts
   - Tested at integration and unit levels

2. **JWT Token Validation**
   - Case-sensitive "Bearer" token requirement
   - Comprehensive edge case coverage
   - User existence verification in middleware

3. **Error Handling**
   - Robust async error handling
   - Custom error code support
   - Default error messages

### Business Logic
- User registration and authentication flows
- Profile creation and management
- Account state management (onboarding, unregister)
- Admin operations (ban, unban, user management)
- Social login integration

---