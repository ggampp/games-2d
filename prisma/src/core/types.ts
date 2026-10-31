export interface Vec {
  x: number;
  y: number;
}

/** Wavelength band in nanometres. Full visible light is [380, 750]. */
export interface Band {
  lo: number;
  hi: number;
}

export type PieceType = 'mirror' | 'prism' | 'lens' | 'dichroic' | 'filter' | 'orb' | 'portal';

export const PIECE_TYPES: PieceType[] = ['mirror', 'prism', 'lens', 'dichroic', 'filter', 'orb', 'portal'];

export interface Piece {
  id: string;
  type: PieceType;
  x: number;
  y: number;
  /** radians */
  angle: number;
  /** Level-authored piece that the player cannot move or remove. */
  fixed?: boolean;
  /** Portals: id of the twin portal. */
  link?: string;
}

export type EmitterKind = 'moon' | 'sun';

export interface Emitter {
  id: string;
  kind: EmitterKind;
  x: number;
  y: number;
  angle: number;
  width: number;
}

export type TargetColor = 'red' | 'green' | 'blue' | 'white' | 'any';
export type TargetKind = 'planet' | 'flower' | 'flag';

export interface Target {
  id: string;
  kind: TargetKind;
  color: TargetColor;
  x: number;
  y: number;
  radius: number;
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BlackHole {
  id: string;
  x: number;
  y: number;
  horizon: number;
  influence: number;
  /** Deflection strength (px^2 units of curvature). */
  mass: number;
}

export interface River {
  id: string;
  y0: number;
  y1: number;
}

export interface Planet {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export type Inventory = Partial<Record<PieceType, number>>;

export interface Level {
  id: number;
  name: string;
  par: number;
  hint?: string;
  inventory: Inventory;
  emitters: Emitter[];
  targets: Target[];
  walls?: Wall[];
  blackHoles?: BlackHole[];
  rivers?: River[];
  planets?: Planet[];
  /** Pieces present when the level loads (fixed or player-movable). */
  pieces?: Piece[];
  sandbox?: boolean;
}

/** One drawable ribbon of light. `pts` has >= 2 points; width interpolates w0 -> w1 along the path. */
export interface BeamSegment {
  pts: Vec[];
  w0: number;
  w1: number;
  band: Band;
  rgb: [number, number, number];
  intensity: number;
  medium: 'air' | 'glass' | 'water';
}

export interface EclipseShadow {
  planet: Planet;
  dir: Vec;
  width: number;
}

export interface TraceResult {
  segments: BeamSegment[];
  litTargets: Map<string, Band>;
  shadows: EclipseShadow[];
  /** Points where a beam entered a portal (for sparkle effects). */
  portalHits: Vec[];
}
