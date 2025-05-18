// landmarks.ts
// TypeScript version of LaserGaze landmarks.py
// Defines key facial landmark indices for gaze estimation and facial analysis

export const OUTER_HEAD_POINTS: number[] = [162, 389];
export const NOSE_BRIDGE: number = 6;
export const NOSE_TIP: number = 4;

export const LEFT_IRIS: number[] = [469, 470, 471, 472];
export const LEFT_PUPIL: number = 468;

export const RIGHT_IRIS: number[] = [474, 475, 476, 477];
export const RIGHT_PUPIL: number = 473;

export const INTERNAL_EYES_CORNERS: number[] = [155, 362];
export const OUTER_EYES_CORNERS: number[] = [33, 263];

export const ADJACENT_LEFT_EYELID_PART: number[] = [160, 159, 158, 163, 144, 145, 153];
export const ADJACENT_RIGHT_EYELID_PART: number[] = [387, 386, 385, 390, 373, 374, 380];

export const BASE_LANDMARKS: number[] = [
  ...INTERNAL_EYES_CORNERS,
  ...OUTER_EYES_CORNERS,
  ...OUTER_HEAD_POINTS,
  NOSE_BRIDGE,
  NOSE_TIP
];

// Utility: Convert normalized landmark to pixel coordinates
export function relative(landmark: [number, number], shape: [number, number]): [number, number] {
  return [
    Math.round(landmark[0] * shape[1]),
    Math.round(landmark[1] * shape[0])
  ];
}

export function relativeT(landmark: [number, number], shape: [number, number]): [number, number, number] {
  return [
    Math.round(landmark[0] * shape[1]),
    Math.round(landmark[1] * shape[0]),
    0
  ];
}
