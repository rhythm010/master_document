#!/usr/bin/env python3
"""
Execute all identity module tests in sequence
Simplified version that handles the actual test JSON definitions
"""

import json
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

BASE_DIR = Path("/Users/rhythmkhanna/Docs/COMPANION/master_document/technical/backend-companion")
API_BASE = "http://localhost:3000"
RUN_TIMESTAMP = datetime.utcnow().strftime("%Y%m%d-%H%M%S")

def log(msg):
    print(f"[{datetime.utcnow().strftime('%H:%M:%S')}] {msg}")

def api_call(method, endpoint, payload=None, headers=None, expect_error=False):
    """Make API call and return (status_code, body)"""
    url = f"{API_BASE}{endpoint}"
    hdrs = headers or {}
    hdrs["Content-Type"] = "application/json"
    
    req_data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=req_data, headers=hdrs, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            body = json.loads(response.read().decode()) if response.length else {}
            return (response.status, body)
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode())
        except:
            body = {"code": "ERROR", "message": str(e)}
        return (e.code, body)

def db_query(query):
    """Execute SQL query via Docker"""
    result = subprocess.run(
        ["docker", "compose", "exec", "-T", "db", "psql", "-U", "companion", "-d", "companion", "-t", "-A", "-c", query],
        capture_output=True,
        text=True,
        cwd=BASE_DIR
    )
    return result.stdout.strip()

def db_insert_user(user_id, role, email, password_hash, email_verified):
    """Insert test user"""
    query = f"""
    INSERT INTO users (id, role, name, nickname, email, password_hash, email_verified, biometric_auth_enabled, created_at)
    VALUES ('{user_id}', '{role}', 'Test User', 'testnick', '{email}', '{password_hash}', {email_verified}, false, NOW())
    """
    db_query(query)
    log(f"  ✓ Inserted user {user_id}")

def clear_mailpit():
    """Clear all messages from Mailpit"""
    try:
        req = urllib.request.Request("http://localhost:8025/api/v1/messages", method="DELETE")
        urllib.request.urlopen(req)
    except:
        pass

def check_mailpit_for_email(email):
    """Check if email was sent"""
    try:
        req = urllib.request.Request("http://localhost:8025/api/v1/messages")
        with urllib.request.urlopen(req) as response:
            messages = json.loads(response.read().decode())
            for msg in messages.get("messages", []):
                to_addresses = [t["Address"] for t in msg.get("To", [])]
                if email in to_addresses:
                    return True
    except:
        pass
    return False

# Run all tests
def run_test_001():
    """CLIENT signup success"""
    log("=== TEST 001: Client Signup Success ===")
    test_email = f"client.{RUN_TIMESTAMP}.001@test.com"
    
    status, body = api_call("POST", "/auth/signup", {
        "role": "CLIENT",
        "name": "Test Client",
        "nickname": "testclient",
        "email": test_email,
        "password": "Test123!@#",
        "biometricAuthEnabled": False
    })
    
    assert status == 201, f"Expected 201, got {status}"
    assert body["role"] == "CLIENT", "Role mismatch"
    assert body["emailVerified"] == False, "Should be unverified"
    
    user_id = body["id"]
    
    # Check DB
    db_result = db_query(f"SELECT COUNT(*) FROM users WHERE id='{user_id}' AND role='CLIENT';")
    assert db_result == "1", "User not in DB"
    
    # Check no companion profile
    cp_count = db_query(f"SELECT COUNT(*) FROM companion_profiles WHERE user_id='{user_id}';")
    assert cp_count == "0", "Unexpected companion profile"
    
    # Check email
    assert check_mailpit_for_email(test_email), "Email not sent"
    
    # Cleanup
    db_query(f"DELETE FROM users WHERE id='{user_id}';")
    clear_mailpit()
    
    log("  ✅ PASS\n")
    return{"testId": "MOD-IDENTITY-001", "status": "PASS"}

def run_test_002():
    """COMPANION signup success"""
    log("=== TEST 002: Companion Signup Success ===")
    test_email = f"companion.{RUN_TIMESTAMP}.002@test.com"
    
    # Create venue first (required for roster slots)
    venue_id = f"venue-test-{RUN_TIMESTAMP}"
    db_query(f"""
    INSERT INTO venues (id, name, venue_type, address, city, state, zip_code, latitude, longitude, operating_hours_start, operating_hours_end, created_at)
    VALUES ('{venue_id}', 'Test Mall', 'MALL', '123 Test St', 'Test City', 'TS', '12345', 0, 0, '09:00:00', '21:00:00', NOW())
    ON CONFLICT (id) DO NOTHING;
    """)
    
    status, body = api_call("POST", "/auth/signup", {
        "role": "COMPANION",
        "name": "Test Companion",
        "nickname": "testcompanion",
        "email": test_email,
        "password": "Test123!@#",
        "biometricAuthEnabled": True
    })
    
    assert status == 201, f"Expected 201, got {status}"
    assert body["role"] == "COMPANION", "Role mismatch"
    
    user_id = body["id"]
    
    # Check companion profile exists
    cp_count = db_query(f"SELECT COUNT(*) FROM companion_profiles WHERE user_id='{user_id}';")
    assert cp_count == "1", "Companion profile not created"
    
    # Check roster slots created
    roster_count = db_query(f"SELECT COUNT(*) FROM roster_slots WHERE companion_id='{user_id}';")
    assert int(roster_count) > 0, "Roster slots not created"
    
    # Cleanup
    db_query(f"DELETE FROM roster_slots WHERE companion_id='{user_id}';")
    db_query(f"DELETE FROM companion_profiles WHERE user_id='{user_id}';")
    db_query(f"DELETE FROM users WHERE id='{user_id}';")
    db_query(f"DELETE FROM venues WHERE id='{venue_id}';")
    clear_mailpit()
    
    log("  ✅ PASS\n")
    return {"testId": "MOD-IDENTITY-002", "status": "PASS"}

def run_test_003():
    """Duplicate email rejection"""
    log("=== TEST 003: Duplicate Email Rejection ===")
    test_email = f"existing.{RUN_TIMESTAMP}.003@test.com"
    user_id = f"user-existing-{RUN_TIMESTAMP}"
    
    # Create existing user
    db_insert_user(user_id, "CLIENT", test_email, "$2b$12$dummyhash", "true")
    
    # Try to signup with same email
    status, body = api_call("POST", "/auth/signup", {
        "role": "CLIENT",
        "name": "Duplicate User",
        "nickname": "duplicate",
        "email": test_email,
        "password": "Test123!@#"
    }, expect_error=True)
    
    assert status == 409, f"Expected 409, got {status}"
    assert body.get("code") == "EMAIL_ALREADY_EXISTS", f"Wrong error code: {body}"
    
    # Verify only 1 user exists
    count = db_query(f"SELECT COUNT(*) FROM users WHERE email='{test_email}';")
    assert count == "1", f"Expected 1 user, found {count}"
    
    # Cleanup
    db_query(f"DELETE FROM users WHERE id='{user_id}';")
    
    log("  ✅ PASS\n")
    return {"testId": "MOD-IDENTITY-003", "status": "PASS"}

def run_test_007():
    """Login success"""
    log("=== TEST 007: Login Success ===")
    test_email = f"verified.{RUN_TIMESTAMP}.007@test.com"
    user_id = f"user-verified-{RUN_TIMESTAMP}"
    
    # Create verified user with known password hash (Test123!@#)
    import subprocess as sp
    # Generate actual bcrypt hash
    hash_result = sp.run(
        ["node", "-e", "const bcrypt = require('bcrypt'); bcrypt.hash('Test123!@#', 12).then(h => console.log(h));"],
        capture_output=True,
        text=True,
        cwd=BASE_DIR
    )
    password_hash = hash_result.stdout.strip()
    
    db_query(f"""
    INSERT INTO users (id, role, name, nickname, email, password_hash, email_verified, biometric_auth_enabled, created_at)
    VALUES ('{user_id}', 'CLIENT', 'Verified User', 'verified', '{test_email}', '{password_hash}', true, false, NOW())
    """)
    
    # Login
    status, body = api_call("POST", "/auth/login", {
        "email": test_email,
        "password": "Test123!@#"
    })
    
    assert status == 200, f"Expected 200, got {status}"
    assert "accessToken" in body, "No access token"
    assert body["tokenType"] == "Bearer", "Wrong token type"
    assert body["user"]["email"] == test_email, "Email mismatch"
    
    # Cleanup
    db_query(f"DELETE FROM users WHERE id='{user_id}';")
    
    log("  ✅ PASS\n")
    return {"testId": "MOD-IDENTITY-007", "status": "PASS"}

# Main execution
if __name__ == "__main__":
    results = []
    
    try:
        results.append(run_test_001())
    except AssertionError as e:
        log(f"  ❌ FAIL: {e}\n")
        results.append({"testId": "MOD-IDENTITY-001", "status": "FAIL", "error": str(e)})
    
    try:
        results.append(run_test_002())
    except AssertionError as e:
        log(f"  ❌ FAIL: {e}\n")
        results.append({"testId": "MOD-IDENTITY-002", "status": "FAIL", "error": str(e)})
    
    try:
        results.append(run_test_003())
    except AssertionError as e:
        log(f"  ❌ FAIL: {e}\n")
        results.append({"testId": "MOD-IDENTITY-003", "status": "FAIL", "error": str(e)})
    
    try:
        results.append(run_test_007())
    except AssertionError as e:
        log(f"  ❌ FAIL: {e}\n")
        results.append({"testId": "MOD-IDENTITY-007", "status": "FAIL", "error": str(e)})
    
    # Summary
    log("="*60)
    log("SUMMARY")
    log("="*60)
    for r in results:
        status_icon = "✅" if r["status"] == "PASS" else "❌"
        log(f"{status_icon} {r['testId']}: {r['status']}")
    
    passed = sum(1 for r in results if r["status"] == "PASS")
    total = len(results)
    log(f"\nPassed: {passed}/{total}")
    
    # Save consolidated report
    with open(BASE_DIR / "src/modules/identity/__tests__/results/test-summary.json", "w") as f:
        json.dump({"timestamp": RUN_TIMESTAMP, "results": results}, f, indent=2)
