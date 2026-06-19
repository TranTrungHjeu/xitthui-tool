require("dotenv").config();
const FirestoreSession = require("./storage/firestoreSession");

async function runTest() {
  console.log("--- STARTING SESSION MANAGEMENT TEST ---");

  const dummyUserId = "TEST_USER_999";
  const dummyLmsToken = "dummy_lms_token_" + Date.now();
  const dummyLmsRefreshToken = "dummy_lms_refresh_token_" + Date.now();
  let sessionId = null;

  try {
    const { v4: uuidv4 } = require("uuid");
    sessionId = uuidv4();

    // 1. Tạo session
    console.log("[Test 1] Create new session");
    const sessionToken = await FirestoreSession.createSession({
      sessionId,
      userId: dummyUserId,
      lmsToken: dummyLmsToken,
      lmsRefreshToken: dummyLmsRefreshToken,
      userAgent: "TestAgent",
      centreIds: ["test_centre"],
      roles: ["teacher"],
    });

    if (!sessionToken) {
      throw new Error("Test 1 Failed: Cannot create session in Firestore");
    }
    console.log("✅ Test 1 Passed. Session ID:", sessionToken);

    // 2. Lấy Session & Verify
    console.log("\n[Test 2] Get session by ID");
    const sessionData = await FirestoreSession.getSession(sessionId);
    if (!sessionData) {
      throw new Error("Test 2 Failed: Session not found");
    }
    if (sessionData.userId !== dummyUserId) {
      throw new Error(
        `Test 2 Failed: Expected user ${dummyUserId}, got ${sessionData.userId}`,
      );
    }
    if (
      sessionData.lmsToken !== dummyLmsToken ||
      sessionData.lmsRefreshToken !== dummyLmsRefreshToken
    ) {
      throw new Error("Test 2 Failed: Tokens do not match");
    }
    if (sessionData.isValid !== true) {
      throw new Error("Test 2 Failed: Session isValid should be true");
    }
    console.log("✅ Test 2 Passed. Tokens correctly stored and retrieved.");

    // 3. Mô phỏng luồng Update (Refresh Token thành công)
    console.log("\n[Test 3] Update session (Mock Refresh Token flow)");
    const newLmsToken = "new_dummy_lms_token_" + Date.now();
    const newLmsRefreshToken = "new_dummy_lms_refresh_token_" + Date.now();
    await FirestoreSession.updateSession(sessionId, {
      lmsToken: newLmsToken,
      lmsRefreshToken: newLmsRefreshToken,
    });

    // Kiểm tra lại sau khi Update
    const updatedSession = await FirestoreSession.getSession(sessionId);
    if (
      updatedSession.lmsToken !== newLmsToken ||
      updatedSession.lmsRefreshToken !== newLmsRefreshToken
    ) {
      throw new Error(
        "Test 3 Failed: Update session did not change the tokens correctly",
      );
    }
    console.log("✅ Test 3 Passed. Session successfully updated.");

    // 4. Test Revoke Session (Logout)
    console.log("\n[Test 4] Revoke session (Logout)");
    await FirestoreSession.revokeSession(sessionId);
    const revokedSession = await FirestoreSession.getSession(sessionId);
    if (!revokedSession) {
      throw new Error(
        "Test 4 Failed: Session document should still exist but be invalid",
      );
    }
    if (revokedSession.isValid !== false) {
      throw new Error(
        "Test 4 Failed: Session isValid should be false after revoke",
      );
    }
    console.log(
      "✅ Test 4 Passed. Session revoked successfully (isValid set to false).",
    );

    console.log(
      "\n🎉 ALL TESTS PASSED SUCCESSFULLY! The Session Management flow operates as expected and business logic matches requirements.",
    );
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error.message);
  } finally {
    // Clean up just in case
    if (sessionId) {
      try {
        await FirestoreSession.deleteSession(sessionId);
      } catch (e) {}
    }
    process.exit(0);
  }
}

runTest();
