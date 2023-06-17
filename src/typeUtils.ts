export type MergeIntersection<T> = {} & { [K in keyof T]: T[K] };
export type Merge<T, U> = MergeIntersection<Omit<T, keyof U> & U>;

type OverloadToTupleRaw<T> = T extends {
  (this: infer AThis, ...args: infer AParams): infer AReturn;
  (this: infer BThis, ...args: infer BParams): infer BReturn;
  (this: infer CThis, ...args: infer CParams): infer CReturn;
  (this: infer DThis, ...args: infer DParams): infer DReturn;
  (this: infer EThis, ...args: infer EParams): infer EReturn;
}
  ? [
      (this: AThis, ...args: AParams) => AReturn,
      (this: BThis, ...args: BParams) => BReturn,
      (this: CThis, ...args: CParams) => CReturn,
      (this: DThis, ...args: DParams) => DReturn,
      (this: EThis, ...args: EParams) => EReturn
    ][number]
  : T extends {
      (this: infer AThis, ...args: infer AParams): infer AReturn;
      (this: infer BThis, ...args: infer BParams): infer BReturn;
      (this: infer CThis, ...args: infer CParams): infer CReturn;
      (this: infer DThis, ...args: infer DParams): infer DReturn;
    }
  ? [
      (this: AThis, ...args: AParams) => AReturn,
      (this: BThis, ...args: BParams) => BReturn,
      (this: CThis, ...args: CParams) => CReturn,
      (this: DThis, ...args: DParams) => DReturn
    ][number]
  : T extends {
      (this: infer AThis, ...args: infer AParams): infer AReturn;
      (this: infer BThis, ...args: infer BParams): infer BReturn;
      (this: infer CThis, ...args: infer CParams): infer CReturn;
    }
  ? [
      (this: AThis, ...args: AParams) => AReturn,
      (this: BThis, ...args: BParams) => BReturn,
      (this: CThis, ...args: CParams) => CReturn
    ][number]
  : T extends {
      (this: infer AThis, ...args: infer AParams): infer AReturn;
      (this: infer BThis, ...args: infer BParams): infer BReturn;
    }
  ? [
      (this: AThis, ...args: AParams) => AReturn,
      (this: BThis, ...args: BParams) => BReturn
    ][number]
  : T extends {
      (this: infer AThis, ...args: infer AParams): infer AReturn;
    }
  ? [(this: AThis, ...args: AParams) => AReturn][number]
  : never;
export type OverloadToTuple<T> = Exclude<
  OverloadToTupleRaw<T>,
  (this: unknown, ...args: unknown[]) => unknown
>;

// https://stackoverflow.com/a/50375286
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;
