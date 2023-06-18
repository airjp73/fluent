import {
  Merge,
  MergeIntersection,
  OverloadToTuple,
  UnionToIntersection,
} from "./typeUtils";
import { FluentError, ShortCircuit } from "./errors";

export type NoData = void;

export type AnyFluentMethod = <
  This extends FluentPipeline<any, any, any, any, any>
>(
  this: This,
  ...args: any[]
) => void;

export interface MethodsObject extends Record<string, AnyFluentMethod> {}

export type FluentMethodData<T> = Awaited<
  ThisParameterType<T> extends FluentPipeline<infer Data, any, any, any, any>
    ? Data
    : never
>;

type FluentMethodsOf<T> = ThisParameterType<T> extends FluentPipeline<
  any,
  any,
  any,
  any,
  infer Methods
>
  ? Methods
  : never;

export type DataTypeMatchesMethod<
  Method extends AnyFluentMethod,
  DataType
> = DataType extends NoData
  ? FluentMethodData<Method> extends unknown
    ? true
    : false
  : Awaited<DataType> extends FluentMethodData<OverloadToTuple<Method>>
  ? true
  : false;

type MethodKeysAcceptingDataType<Methods extends MethodsObject, DataType> = {
  [K in keyof Methods]: DataTypeMatchesMethod<Methods[K], DataType> extends true
    ? Methods extends FluentMethodsOf<OverloadToTuple<Methods[K]>>
      ? K
      : never
    : never;
}[keyof Methods];

type MethodsForDataType<Methods extends MethodsObject, DataType> = {
  [K in MethodKeysAcceptingDataType<Methods, DataType>]: Methods[K];
};

type TerminalOutput<Current, EarlyOutput> = Current extends Promise<any>
  ? Promise<Awaited<EarlyOutput> | Awaited<Current>>
  : Current | EarlyOutput;

export class FluentPipeline<
  Current,
  EarlyOutput,
  Input,
  Meta extends {},
  Methods extends MethodsObject
> {
  public t_innerData: Awaited<this["t_current"]>;

  constructor(
    public t_current: Current,
    public t_earlyOutput: EarlyOutput,
    public t_input: Input,
    public meta: Meta,
    public fluentMethods: Methods,
    protected pipelineSteps: Function[]
  ) {
    this.t_innerData = undefined as any;
    Object.entries(fluentMethods).forEach(([key, value]) => {
      // @ts-ignore
      this[key] = value;
    });
  }

  public transform<const ChainedData>(
    func: (input: this["t_innerData"]) => ChainedData
  ): FluentChain<
    this["t_current"] extends Promise<any>
      ? Promise<Awaited<ChainedData>>
      : ChainedData,
    this["t_earlyOutput"],
    this["t_input"],
    this["meta"],
    this["fluentMethods"]
  > {
    const nextPipeline = [
      ...this.pipelineSteps,
      (data: any) => (data instanceof Promise ? data.then(func) : func(data)),
    ];
    return makeFluentPipeline(
      undefined,
      undefined,
      undefined,
      this.meta,
      this.fluentMethods,
      nextPipeline
    ) as any;
  }

  protected shortCircuit<Keep extends this["t_innerData"], Abort>(
    func: (input: this["t_innerData"]) => Keep | ShortCircuit<Abort>
  ): FluentChain<
    Exclude<
      this["t_current"] extends Promise<any>
        ? Promise<Awaited<Keep>>
        : Awaited<Keep>,
      Abort
    >,
    void extends this["t_earlyOutput"] ? Abort : this["t_earlyOutput"] | Abort,
    void extends this["t_input"] ? Abort : this["t_input"],
    this["meta"],
    this["fluentMethods"]
  > {
    const getEarlyReturns = (data: any) => {
      const res = func(data);
      if (res instanceof ShortCircuit) throw res;
      return res;
    };
    const nextPipeline = [...this.pipelineSteps, getEarlyReturns];
    return makeFluentPipeline(
      undefined,
      undefined,
      undefined,
      this.meta,
      this.fluentMethods,
      nextPipeline
    ) as any;
  }

  protected runFluentPipeline(
    input: any
  ): TerminalOutput<Current, EarlyOutput> {
    if (this.pipelineSteps.length === 0)
      throw new Error("Cannot run empty fluent pipeline");

    const handleError = (error: unknown) => {
      if (error instanceof ShortCircuit) return error.value;
      throw error;
    };

    let current = input;

    try {
      for (const fn of this.pipelineSteps) {
        // How to short circuit with promises?
        if (current instanceof Promise) current = current.then(fn as any);
        else current = fn(current);
      }
    } catch (err) {
      return handleError(err);
    }

    if (current instanceof Promise) return current.catch(handleError) as any;
    return current;
  }

  public check<Result extends boolean | Promise<boolean>>(
    checker: (input: Awaited<Current>) => Result,
    message?: string | ((meta: this["meta"], val: this["t_current"]) => string),
    errorCode?: string
  ): FluentChain<
    Result extends Promise<boolean>
      ? Promise<Awaited<this["t_current"]>>
      : this["t_current"],
    this["t_earlyOutput"],
    this["t_input"],
    this["meta"],
    this["fluentMethods"]
  > {
    return this.transform((prev) => {
      const res = checker(prev);

      const handleResult = (result: boolean) => {
        if (result) return prev;
        // TODO: throw a better error
        const getMsg = () => {
          if (typeof message === "string") return message;
          if (typeof message === "function") return message(this.meta, prev);
        };
        const msg = getMsg();
        throw new FluentError(
          errorCode ?? "unknown_validation_error",
          msg
            ? msg
            : (this.meta as any)?.errorMessages?.unknown_validation_error(
                this.meta
              ) ?? "Validation failed"
        );
      };

      const resolvedValue =
        res instanceof Promise ? res.then(handleResult) : handleResult(res);
      return resolvedValue as any;
    }) as any;
  }

  public checkType<CheckedType>(
    checker: (input: unknown) => input is CheckedType,
    message?: string | ((meta: this["meta"]) => string),
    errorCode?: string
  ): FluentChain<
    CheckedType,
    this["t_earlyOutput"],
    void extends this["t_input"] ? CheckedType : this["t_input"] | CheckedType,
    this["meta"],
    this["fluentMethods"]
  > {
    return this.transform((prev) => {
      if (checker(prev)) return prev;
      const getMsg = () => {
        if (typeof message === "string") return message;
        if (typeof message === "function") return message(this.meta);
      };
      const msg = getMsg();
      throw new FluentError(
        errorCode ?? "unknown_type_validation_error",
        msg
          ? msg
          : (this.meta as any)?.errorMessages?.unknown_type_validation_error(
              this.meta
            ) ?? "Invalid type"
      );
    }) as any;
  }

  protected updateMeta<NewMeta extends {}>(
    meta: NewMeta
  ): FluentChain<
    this["t_current"],
    this["t_earlyOutput"],
    this["t_input"],
    Merge<this["meta"], NewMeta>,
    this["fluentMethods"]
  > {
    return makeFluentPipeline(
      this.t_current,
      this.t_earlyOutput,
      this.t_input,
      { ...this.meta, ...meta },
      this.fluentMethods,
      this.pipelineSteps
    ) as any;
  }
}

export type FluentChain<
  Current,
  EarlyOutput,
  Input,
  Meta extends {},
  Methods extends MethodsObject
> = FluentPipeline<Current, EarlyOutput, Input, Meta, Methods> &
  MethodsForDataType<Methods, Current>;

export type AnyFluentChain = FluentPipeline<any, any, any, any, any> &
  MethodsObject;

const makeFluentPipeline = <
  Current,
  EarlyOutput,
  Input,
  Meta extends {},
  Methods extends MethodsObject
>(
  data: Current,
  earlyOutput: EarlyOutput,
  input: Input,
  meta: Meta,
  methods: Methods,
  pipelineSteps: Function[] = []
): FluentPipeline<Current, EarlyOutput, Input, Meta, Methods> &
  MethodsForDataType<Methods, Current> =>
  new FluentPipeline(
    data,
    earlyOutput,
    input,
    meta,
    methods,
    pipelineSteps
  ) as any;

type ExtractErrorDefinitions<T extends MethodsObject> = UnionToIntersection<
  {
    [K in keyof T]: T[K] extends {
      errors: infer Errors extends Record<
        string | symbol,
        string | ((...args: any[]) => string)
      >;
    }
      ? Errors
      : never;
  }[keyof T]
>;

type Default<T, U> = T extends undefined ? U : T;
interface FluentBuilder<
  Methods extends MethodsObject,
  Meta extends {
    errorMessages?: Record<string | symbol, string | ((meta: any) => string)>;
  }
> {
  __fluentMethods: Methods;
  __meta: Meta;
  <const Data>(data: Data): FluentChain<
    Data,
    NoData,
    Data,
    Merge<Meta, { fluentInput: Data }>,
    Methods
  >;
  (): FluentChain<NoData, NoData, NoData, Meta, Methods>;
  extend<NewMethods extends MethodsObject>(
    methods: NewMethods
  ): FluentBuilder<
    Merge<Methods, NewMethods>,
    Merge<
      Meta,
      {
        errorMessages: Merge<
          Meta["errorMessages"],
          ExtractErrorDefinitions<NewMethods>
        >;
      }
    >
  >;
  customizeErrors<
    NewErrorMessages extends Partial<Default<Meta["errorMessages"], {}>>
  >(
    newErrorMessages: NewErrorMessages
  ): FluentBuilder<
    Methods,
    Merge<
      Meta,
      {
        errorMessages: Merge<Meta["errorMessages"], NewErrorMessages>;
      }
    >
  >;
}

const makeFluentBuilder = <
  const Methods extends MethodsObject,
  Meta extends {}
>(
  methods: Methods,
  meta: Meta
): FluentBuilder<Methods, Meta> => {
  function builder(maybeData?: any) {
    return new FluentPipeline(
      undefined,
      undefined,
      undefined,
      {
        ...meta,
        fluentInput: maybeData,
      },
      methods,
      []
    ) as any;
  }
  builder.__fluentMethods = methods;
  builder.__meta = meta;
  builder.extend = (newMethods: MethodsObject) => {
    const transformErrorMessages = Object.values(newMethods).reduce(
      (acc: any, val: any) => {
        if ((val as any).errors) {
          Object.entries((val as any).errors).forEach(([key, msg]) => {
            acc[key] = msg;
          });
        }
        return acc;
      },
      {}
    );

    return makeFluentBuilder(
      {
        ...methods,
        ...newMethods,
      },
      {
        ...meta,
        errorMessages: {
          ...(meta as any).errorMessages,
          ...transformErrorMessages,
        },
      }
    );
  };
  builder.customizeErrors = (newErrorMessages: any) => {
    return makeFluentBuilder(methods, {
      ...meta,
      errorMessages: {
        ...(meta as any).errorMessages,
        ...newErrorMessages,
      },
    });
  };
  return builder as any;
};

export const fluent = makeFluentBuilder(
  {},
  {
    errorMessages: {
      unknown_validation_error: (meta: any) => "Validation failed",
      unknown_type_validation_error: (meta: any) => "Invalid type",
    },
  }
);

export type Fluent<Current = any, Input = any> = FluentPipeline<
  Current | Promise<Current>,
  unknown,
  Input,
  {},
  {}
>;
export type EmptyFluent = Fluent<NoData, NoData>;
export type FluentData<
  FluentInstance extends FluentPipeline<any, any, any, any, any>
> = Awaited<FluentInstance["t_current"]>;
export type FluentInput<FluentInstance extends Fluent> =
  FluentInstance["t_input"];

export const toFluentMethod = <Data, Args extends any[], Return>(
  fn: (data: Data, ...args: Args) => Return
) => {
  return function <This extends Fluent<Data>>(this: This, ...args: Args) {
    return this.transform((data) => fn(data, ...args));
  };
};
