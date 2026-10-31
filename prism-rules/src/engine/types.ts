export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

export type OpticalItemType = 'prism' | 'green' | 'lens' | 'mirror';

export type TargetColor = 'green' | 'red' | 'blue' | 'white';

export interface OpticalPiece {
  id: string;
  type: OpticalItemType;
  x: number;
  y: number;
  angle: number; // in radians
  size: number;
  isDragging?: boolean;
  isRotating?: boolean;
}

export interface LightEmitter {
  x: number;
  y: number;
  angle: number; // direction of emitted beam in radians
  beamWidth: number;
  intensity: number;
}

export interface Target {
  id: string;
  x: number;
  y: number;
  radius: number;
  colorType: TargetColor;
  isLit: boolean;
  lightIntensity: number; // 0 to 1 for smooth transitions
}

export interface BlackHole {
  x: number;
  y: number;
  mass: number;
  eventHorizonRadius: number;
  accretionRadius: number;
}

export interface WallObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RaySegment {
  path: Point[];
  color: string;
  wavelength?: number; // 380nm to 750nm
  intensity: number;
  width: number;
  isRainbow?: boolean;
}

export interface LevelDefinition {
  id: number;
  name: string;
  par: number;
  description?: string;
  inventory: Record<OpticalItemType, number>;
  emitter: LightEmitter;
  targets: Target[];
  blackHoles: BlackHole[];
  walls: WallObstacle[];
  preplacedPieces?: OpticalPiece[];
}
