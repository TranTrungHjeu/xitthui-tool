/**
 * Utility to identify if an error is due to LMS authentication failure or token expiration.
 */
function isLmsAuthError(err) {
  if (!err) return false;
  
  // Check HTTP response status
  if (err.response?.status === 401) return true;
  
  // Check exception message
  const msg = err.message || "";
  if (
    msg.includes("401") ||
    msg.includes("Authentication failed") ||
    msg.includes("Unauthorized") ||
    msg.includes("unauthenticated") ||
    msg.includes("UNAUTHENTICATED")
  ) {
    return true;
  }

  // Check GraphQL errors
  if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
    return err.response.data.errors.some(e => {
      const eMsg = e.message || "";
      return (
        eMsg.includes("Unauthorized") ||
        eMsg.includes("Authentication failed") ||
        eMsg.includes("401") ||
        e.extensions?.code === "UNAUTHENTICATED"
      );
    });
  }

  return false;
}

module.exports = {
  isLmsAuthError,
};
