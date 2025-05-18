// AffineTransformer.ts
// TypeScript version of LaserGaze AffineTransformer (Python)
// Calculates and applies affine transformation between two sets of 3D points

export class AffineTransformer {
  private scaleFactor: number;
  private transformMatrix: number[][] | null = null; // 3x4 matrix
  public success: boolean = false;

  constructor(
    m1Points: number[][], // Nx3
    m2Points: number[][], // Nx3
    m1HorPoints: number[][], // 2x3
    m1VerPoints: number[][], // 2x3
    m2HorPoints: number[][], // 2x3
    m2VerPoints: number[][]  // 2x3
  ) {
    this.scaleFactor = AffineTransformer.getScaleFactor(m1HorPoints, m1VerPoints, m2HorPoints, m2VerPoints);
    const scaledM2Points = m2Points.map(p => p.map((v) => v * this.scaleFactor));
    this.transformMatrix = AffineTransformer.estimateAffine3D(m1Points, scaledM2Points);
    this.success = !!this.transformMatrix;
  }

  // Calculate scale factor between two sets of reference points
  static getScaleFactor(
    m1Hor: number[][], m1Ver: number[][],
    m2Hor: number[][], m2Ver: number[][]
  ): number {
    const dist = (a: number[], b: number[]) => Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
    const m1Width = dist(m1Hor[0], m1Hor[1]);
    const m1Height = dist(m1Ver[0], m1Ver[1]);
    const m2Width = dist(m2Hor[0], m2Hor[1]);
    const m2Height = dist(m2Ver[0], m2Ver[1]);
    const scaleWidth = m1Width / m2Width;
    const scaleHeight = m1Height / m2Height;
    return (scaleWidth + scaleHeight) / 2;
  }

  // Estimate 3D affine matrix (3x4) using least squares
  // Returns 3x4 matrix or null
  static estimateAffine3D(src: number[][], dst: number[][]): number[][] | null {
    if (src.length !== dst.length || src.length < 4) return null;
    // Build Ax = b, where x is 12 params of 3x4 matrix
    const N = src.length;
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < N; ++i) {
      const [x, y, z] = src[i];
      // Row for X'
      A.push([x, y, z, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
      // Row for Y'
      A.push([0, 0, 0, 0, x, y, z, 1, 0, 0, 0, 0]);
      // Row for Z'
      A.push([0, 0, 0, 0, 0, 0, 0, 0, x, y, z, 1]);
      b.push(dst[i][0], dst[i][1], dst[i][2]);
    }
    // Solve least squares: x = (A^T A)^-1 A^T b
    // Use mathjs or implement directly
    // For small N, use pseudo-inverse
    const AT = AffineTransformer.transpose(A);
    const ATA = AffineTransformer.multiply(AT, A);
    const ATb = AffineTransformer.multiplyVec(AT, b);
    const ATAinv = AffineTransformer.inv(ATA);
    if (!ATAinv) return null;
    const x = AffineTransformer.multiplyVec(ATAinv, ATb); // 12 params
    // Reshape to 3x4
    return [
      x.slice(0,4),
      x.slice(4,8),
      x.slice(8,12)
    ];
  }

  // --- Linear algebra helpers ---
  static transpose(m: number[][]): number[][] {
    return m[0].map((_, i) => m.map(row => row[i]));
  }
  static multiply(a: number[][], b: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < a.length; ++i) {
      result[i] = [];
      for (let j = 0; j < b[0].length; ++j) {
        let sum = 0;
        for (let k = 0; k < b.length; ++k) sum += a[i][k] * b[k][j];
        result[i][j] = sum;
      }
    }
    return result;
  }
  static multiplyVec(a: number[][], v: number[]): number[] {
    return a.map(row => row.reduce((sum, val, i) => sum + val * v[i], 0));
  }
  static inv(m: number[][]): number[][] | null {
    // Only for small square matrices (12x12)
    // Use Gauss-Jordan elimination
    const n = m.length;
    const A = m.map(row => row.slice());
    const I = Array.from({length: n}, (_, i) => Array.from({length: n}, (_, j) => i === j ? 1 : 0));
    for (let i = 0; i < n; ++i) {
      // Find pivot
      let maxRow = i;
      for (let k = i+1; k < n; ++k) if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
      if (A[maxRow][i] === 0) return null;
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [I[i], I[maxRow]] = [I[maxRow], I[i]];
      // Normalize row
      const f = A[i][i];
      for (let j = 0; j < n; ++j) { A[i][j] /= f; I[i][j] /= f; }
      // Eliminate
      for (let k = 0; k < n; ++k) {
        if (k === i) continue;
        const c = A[k][i];
        for (let j = 0; j < n; ++j) {
          A[k][j] -= c * A[i][j];
          I[k][j] -= c * I[i][j];
        }
      }
    }
    return I;
  }

  // Transform point from m1 to m2
  public toM2(m1Point: number[]): number[] | null {
    if (!this.success || !this.transformMatrix) return null;
    const p = [...m1Point, 1]; // homogeneous
    const res = [
      this.transformMatrix[0][0]*p[0] + this.transformMatrix[0][1]*p[1] + this.transformMatrix[0][2]*p[2] + this.transformMatrix[0][3],
      this.transformMatrix[1][0]*p[0] + this.transformMatrix[1][1]*p[1] + this.transformMatrix[1][2]*p[2] + this.transformMatrix[1][3],
      this.transformMatrix[2][0]*p[0] + this.transformMatrix[2][1]*p[1] + this.transformMatrix[2][2]*p[2] + this.transformMatrix[2][3]
    ];
    return res.map(v => v / this.scaleFactor);
  }

  // Transform point from m2 to m1 (inverse)
  public toM1(m2Point: number[]): number[] | null {
    if (!this.success || !this.transformMatrix) return null;
    // Build 4x4 matrix
    const M = [
      [...this.transformMatrix[0]],
      [...this.transformMatrix[1]],
      [...this.transformMatrix[2]],
      [0,0,0,1]
    ];
    // Invert
    const Minv = AffineTransformer.inv4x4(M);
    if (!Minv) return null;
    const p = [...m2Point.map(v => v * this.scaleFactor), 1];
    const res = [
      Minv[0][0]*p[0] + Minv[0][1]*p[1] + Minv[0][2]*p[2] + Minv[0][3]*p[3],
      Minv[1][0]*p[0] + Minv[1][1]*p[1] + Minv[1][2]*p[2] + Minv[1][3]*p[3],
      Minv[2][0]*p[0] + Minv[2][1]*p[1] + Minv[2][2]*p[2] + Minv[2][3]*p[3],
      Minv[3][0]*p[0] + Minv[3][1]*p[1] + Minv[3][2]*p[2] + Minv[3][3]*p[3]
    ];
    return [res[0]/res[3], res[1]/res[3], res[2]/res[3]];
  }

  // Invert 4x4 matrix (for toM1)
  static inv4x4(m: number[][]): number[][] | null {
    // Use mathjs or implement directly (for small matrices)
    // Here, use Gauss-Jordan elimination (reuse inv for 4x4)
    if (m.length !== 4 || m[0].length !== 4) return null;
    return AffineTransformer.inv(m);
  }
}
