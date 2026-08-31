/**
 * Common 2D mathematical utilities and helper functions.
 */
export class MathUtils {
  /**
   * Clamps a value between a minimum and maximum boundary.
   */
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Linearly interpolates between two numbers.
   * @param a Start value
   * @param b End value
   * @param t Interpolation alpha (0.0 to 1.0)
   */
  public static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * MathUtils.clamp(t, 0, 1);
  }

  /**
   * Converts degrees to radians.
   */
  public static degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Converts radians to degrees.
   */
  public static radToDeg(radians: number): number {
    return (radians * 180) / Math.PI;
  }

  /**
   * Smoothstep interpolation.
   */
  public static smoothStep(min: number, max: number, value: number): number {
    const x = MathUtils.clamp((value - min) / (max - min), 0, 1);
    return x * x * (3 - 2 * x);
  }

  /**
   * Checks if two floating point numbers are approximately equal.
   */
  public static approximately(a: number, b: number, epsilon: number = 0.00001): boolean {
    return Math.abs(a - b) < epsilon;
  }
}
