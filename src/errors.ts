export type FluentErrorDetails = {
  code: string;
  message: string;
  path: (string | number)[];
  childIssues: ReturnType<FluentError["toDetails"]>[];
};

const formatError = (
  { code, path, message, childIssues }: FluentErrorDetails,
  indent = 0
): string => {
  let str = "";

  if (path.length) str += `\`${path.join(".")}\` -- `;

  str += message;

  if (childIssues.length) {
    str += "\n";
    str += childIssues
      .map((issue) => formatError(issue, indent + 1))
      .join("\n");
  }

  // Indent
  str = str
    .split("\n")
    .map((line) => " ".repeat(indent * 2) + line)
    .join("\n");

  return str;
};

export class FluentError extends Error {
  public path: (string | number)[];
  public childIssues: FluentError[];

  constructor(
    public code: string,
    public validationMessage: string,
    path?: (string | number)[],
    childIssues?: FluentError[]
  ) {
    super(
      formatError({
        code,
        message: validationMessage,
        path: path ?? [],
        childIssues: (childIssues ?? []).map((issue) => issue.toDetails()),
      })
    );
    this.path = path ?? [];
    this.childIssues = childIssues ?? [];
  }

  public toDetails(): FluentErrorDetails {
    return {
      code: this.code,
      message: this.validationMessage,
      path: this.path,
      childIssues: this.childIssues.map((issue) => issue.toDetails()),
    };
  }

  public prependPath(...path: (string | number)[]) {
    this.path.unshift(...path);
    this.childIssues.forEach((issue) => issue.prependPath(...path));
  }
}

export class ShortCircuit<T> {
  constructor(public value: T) {}
}

export const shortCircuit = <T>(value: T) => new ShortCircuit(value);
