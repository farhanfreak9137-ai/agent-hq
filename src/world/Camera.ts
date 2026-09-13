import { Position } from '../types/index.ts';

export class Camera {
  public x: number = 760;
  public y: number = 510;
  public zoom: number = 1.0;

  public targetX: number = 760;
  public targetY: number = 510;
  public targetZoom: number = 1.0;

  public minZoom: number = 0.45;
  public maxZoom: number = 2.4;

  public viewportWidth: number = 1200;
  public viewportHeight: number = 800;

  public isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private cameraStartX: number = 0;
  private cameraStartY: number = 0;

  // Smoothing factor
  private readonly lerpFactor = 0.12;

  constructor(viewportWidth: number = 1200, viewportHeight: number = 800) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.centerOnWorld(1520, 1020);
  }

  public updateViewport(w: number, h: number): void {
    this.viewportWidth = Math.max(300, w);
    this.viewportHeight = Math.max(300, h);
  }

  public update(): void {
    // Smoothly interpolate towards target
    this.x += (this.targetX - this.x) * this.lerpFactor;
    this.y += (this.targetY - this.y) * this.lerpFactor;
    this.zoom += (this.targetZoom - this.zoom) * this.lerpFactor;
  }

  public centerOnWorld(worldWidth: number = 1520, worldHeight: number = 1020): void {
    this.targetX = worldWidth / 2;
    this.targetY = worldHeight / 2;

    // Calculate zoom that fits nicely
    const zoomX = (this.viewportWidth - 60) / worldWidth;
    const zoomY = (this.viewportHeight - 60) / worldHeight;
    const fitZoom = Math.min(zoomX, zoomY, 1.1);

    this.targetZoom = Math.max(this.minZoom, fitZoom);
  }

  public focusOnPosition(pos: Position, targetZoom?: number): void {
    this.targetX = pos.x;
    this.targetY = pos.y;
    if (targetZoom) {
      this.targetZoom = Math.min(this.maxZoom, Math.max(this.minZoom, targetZoom));
    }
  }

  public zoomBy(delta: number, screenPoint?: Position): void {
    const prevZoom = this.targetZoom;
    let newZoom = prevZoom * (1 - delta * 0.0015);
    newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, newZoom));

    if (screenPoint) {
      // Zoom towards screen point
      const worldBefore = this.screenToWorld(screenPoint.x, screenPoint.y);
      this.targetZoom = newZoom;
      // Adjust camera so worldBefore stays under cursor
      this.targetX = worldBefore.x - (screenPoint.x - this.viewportWidth / 2) / newZoom;
      this.targetY = worldBefore.y - (screenPoint.y - this.viewportHeight / 2) / newZoom;
    } else {
      this.targetZoom = newZoom;
    }
  }

  public startDrag(screenX: number, screenY: number): void {
    this.isDragging = true;
    this.dragStartX = screenX;
    this.dragStartY = screenY;
    this.cameraStartX = this.x;
    this.cameraStartY = this.y;
  }

  public onDrag(screenX: number, screenY: number): void {
    if (!this.isDragging) return;
    const dx = (screenX - this.dragStartX) / this.zoom;
    const dy = (screenY - this.dragStartY) / this.zoom;

    this.targetX = this.cameraStartX - dx;
    this.targetY = this.cameraStartY - dy;
    this.x = this.targetX;
    this.y = this.targetY;
  }

  public endDrag(): void {
    this.isDragging = false;
  }

  public screenToWorld(screenX: number, screenY: number): Position {
    const x = (screenX - this.viewportWidth / 2) / this.zoom + this.x;
    const y = (screenY - this.viewportHeight / 2) / this.zoom + this.y;
    return { x, y };
  }

  public worldToScreen(worldX: number, worldY: number): Position {
    const x = (worldX - this.x) * this.zoom + this.viewportWidth / 2;
    const y = (worldY - this.y) * this.zoom + this.viewportHeight / 2;
    return { x, y };
  }
}
