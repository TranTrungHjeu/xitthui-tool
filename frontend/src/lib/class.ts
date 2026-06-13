const GRADING_ENABLED_CODES = [
  "SB",
  "SA",
  "SI",
  "GA",
  "GB",
  "GI",
  "PTB",
  "PTA",
  "PTI",
];

/**
 * Checks if a class should show the Grading (Chấm bài) tab based on its course short name.
 * Reusable helper for class-related logic.
 */
export const shouldShowGrading = (shortName?: string): boolean => {
  if (!shortName) return false;
  // Check if the shortName contains any of the specified codes
  return GRADING_ENABLED_CODES.some((code) => shortName.includes(code));
};

