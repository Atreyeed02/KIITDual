/**
 * Deterministic SVG Identicon Generator for FocusMatch Anonymous Identities
 * Generates geometric identicon properties based on an avatar seed string.
 * Visually matched to Stitch dark glassmorphism & geometric identicon designs.
 */

// Palette pairs matching Stitch design tokens
const PALETTES = [
  { primary: '#6C7CFF', secondary: '#3DD9B3', bg1: '#1A2133', bg2: '#0F1420' },
  { primary: '#3DD9B3', secondary: '#FFB547', bg1: '#16282E', bg2: '#0F1420' },
  { primary: '#FFB547', secondary: '#6C7CFF', bg1: '#26201B', bg2: '#0F1420' },
  { primary: '#A78BFA', secondary: '#3DD9B3', bg1: '#211B33', bg2: '#0F1420' },
  { primary: '#F43F5E', secondary: '#FFB547', bg1: '#291820', bg2: '#0F1420' },
  { primary: '#38BDF8', secondary: '#6C7CFF', bg1: '#152533', bg2: '#0F1420' },
];

/**
 * Hash function to convert string seed to 32-bit integer
 */
function hashString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export interface IdenticonConfig {
  palette: typeof PALETTES[0];
  shapeType: 'concentric' | 'diamonds' | 'polygrid' | 'orbit';
  rotation: number;
  innerScale: number;
}

export function getIdenticonConfig(seed: string): IdenticonConfig {
  const hash = hashString(seed || 'QuietFalcon482');
  
  const paletteIndex = hash % PALETTES.length;
  const shapeTypes: IdenticonConfig['shapeType'][] = ['concentric', 'diamonds', 'polygrid', 'orbit'];
  const shapeIndex = (hash >> 3) % shapeTypes.length;
  const rotation = ((hash >> 6) % 8) * 45;
  const innerScale = 0.6 + ((hash >> 9) % 4) * 0.1;

  return {
    palette: PALETTES[paletteIndex],
    shapeType: shapeTypes[shapeIndex],
    rotation,
    innerScale,
  };
}
