import * as THREE from 'three';

/**
 * Full-viewport continuous stage backdrop for orthographic side-scroller.
 * Panels always span the full camera height — no empty blue/green bands.
 * Dirt road is painted in the lower part of the art (characters stand on it).
 */
export class ScrollingBackground {
  readonly group = new THREE.Group();
  private readonly panels: THREE.Mesh[] = [];
  private readonly panelWidth: number;
  private readonly panelHeight: number;
  private readonly count: number;

  constructor(
    texture: THREE.Texture,
    viewHeight: number,
    count = 5,
  ) {
    this.count = count;
    this.panelHeight = viewHeight;
    const img = texture.image as { width?: number; height?: number } | undefined;
    const aspect =
      img?.width && img?.height ? img.width / img.height : 16 / 9;
    this.panelWidth = this.panelHeight * aspect;

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        depthWrite: false,
        depthTest: true,
      });
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(this.panelWidth, this.panelHeight),
        mat,
      );
      // Centered on Y=0 so it fills orthographic top/bottom exactly
      mesh.position.z = -4;
      mesh.renderOrder = -50;
      this.panels.push(mesh);
      this.group.add(mesh);
    }
  }

  /** Tile panels around cameraX so the stage feels endless. */
  update(cameraX: number): void {
    const total = this.panelWidth * this.count;
    for (let i = 0; i < this.panels.length; i++) {
      let x = cameraX - total * 0.5 + i * this.panelWidth + this.panelWidth * 0.5;
      while (x < cameraX - total * 0.5) x += total;
      while (x >= cameraX + total * 0.5) x -= total;
      this.panels[i].position.x = x;
      this.panels[i].position.y = 0;
      this.panels[i].position.z = -4;
    }
  }

  get tileWidth(): number {
    return this.panelWidth;
  }

  dispose(): void {
    for (const panel of this.panels) {
      panel.geometry.dispose();
      (panel.material as THREE.Material).dispose();
    }
  }
}
