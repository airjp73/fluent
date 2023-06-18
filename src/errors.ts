export class FluentError extends Error {
  public path: (string | number)[];
  public childIssues: FluentError[];

  constructor(
    public code: string,
    public message: string,
    path?: (string | number)[],
    childIssues?: FluentError[]
  ) {
    super(message);
    this.path = path ?? [];
    this.childIssues = childIssues ?? [];
  }

  public toDetails(): {
    code: string;
    message: string;
    path: (string | number)[];
    childIssues: ReturnType<FluentError["toDetails"]>[];
  } {
    return {
      code: this.code,
      message: this.message,
      path: this.path,
      childIssues: this.childIssues.map((issue) => issue.toDetails()),
    };
  }
}

export class ShortCircuit<T> {
  constructor(public value: T) {}
}

export const shortCircuit = <T>(value: T) => new ShortCircuit(value);
