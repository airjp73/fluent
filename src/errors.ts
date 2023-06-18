export class FluentError extends Error {
  public path: (string | number)[] = [];
  constructor(public code: string, public message: string) {
    super(message);
  }
}

export class ShortCircuit<T> {
  constructor(public value: T) {}
}

export const shortCircuit = <T>(value: T) => new ShortCircuit(value);
