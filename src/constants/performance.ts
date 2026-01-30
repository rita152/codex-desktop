/**
 * Performance-related constants for the application.
 * Centralized here for easy tuning and configuration.
 */
export const PERFORMANCE = {
  // Typewriter effect
  TYPEWRITER_SPEED_CHARS_PER_SEC: 120,
  TYPEWRITER_MAX_CHARS_PER_FRAME: 12,

  // Message handling
  ASSISTANT_APPEND_GRACE_MS: 1500,

  // Virtualization
  MESSAGE_ESTIMATE_HEIGHT: 120,
  MESSAGE_OVERSCAN: 6,

  // Working timer
  WORKING_TIMER_INTERVAL_MS: 200,

  // Scroll detection
  SCROLL_BOTTOM_THRESHOLD: 50,

  // Panel resize
  MIN_CONVERSATION_WIDTH: 240,
} as const;
