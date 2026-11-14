/** Rotation of the orb: a steady turn, drag to spin, momentum that fades and a soft spring back to the resting tilt. */

export const REST_TILT = 0.24;
const YAW_PER_PX = 0.008;
const PITCH_PER_PX = 0.005;
const PITCH_LIMIT = 0.7;
const FRICTION = 2.6;
const SPRING_K = 22;
const SPRING_C = 7;

export class Spin {
  yaw = 0;
  pitch = REST_TILT;
  private yawVelocity = 0;
  private pitchVelocity = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;

  get isDragging(): boolean {
    return this.dragging;
  }

  grab(x: number, y: number, t: number): void {
    this.dragging = true;
    this.lastX = x;
    this.lastY = y;
    this.lastT = t;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  drag(x: number, y: number, t: number): void {
    if (!this.dragging) return;
    const dt = Math.max(1, t - this.lastT) / 1000;
    const dYaw = (x - this.lastX) * YAW_PER_PX;
    const dPitch = (y - this.lastY) * PITCH_PER_PX;
    this.yaw += dYaw;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + dPitch));
    this.yawVelocity = dYaw / dt;
    this.lastX = x;
    this.lastY = y;
    this.lastT = t;
  }

  release(): void {
    this.dragging = false;
  }

  /** Advances by `dt` seconds with the state's own turning rate in radians per second. */
  step(dt: number, rate: number): void {
    if (this.dragging) return;
    this.yaw += (rate + this.yawVelocity) * dt;
    this.yawVelocity *= Math.exp(-FRICTION * dt);
    const force = -SPRING_K * (this.pitch - REST_TILT) - SPRING_C * this.pitchVelocity;
    this.pitchVelocity += force * dt;
    this.pitch += this.pitchVelocity * dt;
  }
}
