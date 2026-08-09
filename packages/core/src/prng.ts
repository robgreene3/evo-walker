export const PRNG_IDENTITY = "mulberry32-v1" as const;

export interface PrngState {
  readonly algorithm: typeof PRNG_IDENTITY;
  readonly state: number;
}

export class Mulberry32 {
  private state: number;

  public constructor(seed: number) {
    if (!Number.isSafeInteger(seed)) {
      throw new TypeError("PRNG seed must be a safe integer.");
    }
    this.state = seed >>> 0;
  }

  public static fromSnapshot(snapshot: {
    readonly algorithm: string;
    readonly state: number;
  }): Mulberry32 {
    if (
      snapshot.algorithm !== PRNG_IDENTITY ||
      !Number.isSafeInteger(snapshot.state) ||
      snapshot.state < 0 ||
      snapshot.state > 0xffff_ffff
    ) {
      throw new TypeError("Invalid Mulberry32 snapshot.");
    }
    return new Mulberry32(snapshot.state);
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  public range(minimum: number, maximum: number): number {
    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum > maximum
    ) {
      throw new RangeError("PRNG range must contain finite ordered bounds.");
    }
    return minimum + this.next() * (maximum - minimum);
  }

  public snapshot(): PrngState {
    return { algorithm: PRNG_IDENTITY, state: this.state };
  }
}
