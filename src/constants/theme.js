// src/constants/theme.js
export const COLORS = {
  bg: '#000000',                          // iOS Deep Black
  card: '#1C1C1E',                        // iOS Secondary Background
  cardBorder: 'rgba(255, 255, 255, 0.08)',  // Ultra-fine iOS Stroke
  cardSurface: '#2C2C2E',                 // iOS Tertiary Background
  input: '#2C2C2E',

  primary: '#0A84FF',                     // iOS Electric Blue
  primarySoft: 'rgba(10, 132, 255, 0.15)',

  success: '#30D158',                     // iOS Mint Green
  successSoft: 'rgba(48, 209, 88, 0.15)',
  successDeep: '#0D2D1B',

  error: '#FF453A',                       // iOS Coral Red
  errorSoft: 'rgba(255, 69, 58, 0.15)',

  today: '#FF9F0A',                       // iOS Amber / Orange
  todaySoft: 'rgba(255, 159, 10, 0.15)',

  text: '#FFFFFF',                        // iOS Primary Label
  subtext: 'rgba(235, 235, 245, 0.60)',   // iOS Secondary Label
  dim: 'rgba(235, 235, 245, 0.30)',       // iOS Tertiary Label

  overlay: 'rgba(0, 0, 0, 0.78)',
};

export const SPRING_CONFIG = {
  stiffness: 420,
  damping: 28,
  mass: 0.8,
};
