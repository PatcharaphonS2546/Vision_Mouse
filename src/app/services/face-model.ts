// face-model.ts
// TypeScript version of LaserGaze face_model.py
// Universal face model for head coordinate space, key facial points, and default eye geometry

export const INTERNAL_EYES_CORNERS_MODEL: number[][] = [
  [-0.035, -0.05, 0],
  [0.035, -0.05, 0]
];

export const OUTER_EYES_CORNERS_MODEL: number[][] = [
  [-0.09, -0.057, 0.01],
  [0.09, -0.057, 0.01]
];

export const OUTER_HEAD_POINTS_MODEL: number[][] = [
  [-0.145, -0.1, 0.1],
  [0.145, -0.1, 0.1]
];

export const NOSE_BRIDGE_MODEL: number[][] = [
  [0, -0.0319, -0.0432]
];

export const NOSE_TIP_MODEL: number[][] = [
  [0, 0.088, -0.071]
];

export const BASE_FACE_MODEL: number[][] = [
  ...INTERNAL_EYES_CORNERS_MODEL,
  ...OUTER_EYES_CORNERS_MODEL,
  ...OUTER_HEAD_POINTS_MODEL,
  ...NOSE_BRIDGE_MODEL,
  ...NOSE_TIP_MODEL
];

export const DEFAULT_LEFT_EYE_CENTER_MODEL: number[] = [
  (INTERNAL_EYES_CORNERS_MODEL[0][0] + OUTER_EYES_CORNERS_MODEL[0][0]) * 0.5,
  (INTERNAL_EYES_CORNERS_MODEL[0][1] + OUTER_EYES_CORNERS_MODEL[0][1]) * 0.5 - 0.009,
  0.02
];

export const DEFAULT_RIGHT_EYE_CENTER_MODEL: number[] = [
  (INTERNAL_EYES_CORNERS_MODEL[1][0] + OUTER_EYES_CORNERS_MODEL[1][0]) * 0.5,
  (INTERNAL_EYES_CORNERS_MODEL[1][1] + OUTER_EYES_CORNERS_MODEL[1][1]) * 0.5 - 0.009,
  0.02
];

export const DEFAULT_EYE_RADIUS = 0.02;
