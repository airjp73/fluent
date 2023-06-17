export class FluentError extends Error {
  public path: (string | number)[] = [];
  constructor(public code: string, public message: string) {
    super(message);
  }
}
