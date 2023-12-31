import { Merge, OverloadToTuple, UnionToIntersection } from "./typeUtils";
import { FluentError, ShortCircuit } from "./errors";

export type PipelineTypes = "data-first" | "data-last";
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

// Removing `void` from a type is annoying, because it also takes `undefined` with it.
type ExcludeVoid<T> = T extends void
  ? T extends undefined
    ? Exclude<T, void> | undefined
    : Exclude<T, void>
  : T;

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
  ? Promise<void extends EarlyOutput ? Current : Current | EarlyOutput>
  : void extends EarlyOutput
  ? Current
  : Current | EarlyOutput;

export type Infer<F extends FluentPipeline<any, any, any, any, any>> =
  TerminalOutput<F["t_current"], F["t_earlyOutput"]>;

// Similar trick to MergeIntersection, but that doesn't lose the FluentPipeline class
type ExpandFluent<T> = T extends FluentChain<
  infer A,
  infer B,
  infer C,
  infer D,
  infer E
>
  ? FluentChain<A, B, C, D, E>
  : never;

export type CheckType<
  This extends FluentPipeline<any, any, any, any, any>,
  CheckedType
> = ExpandFluent<
  FluentChain<
    CheckedType,
    This["t_earlyOutput"],
    // Only update the type if the input is still `void`
    void extends This["t_input"]
      ? CheckedType | ExcludeVoid<This["t_input"]>
      : This["t_input"],
    This["meta"],
    This["fluentMethods"]
  >
>;

export type Check<
  This extends FluentPipeline<any, any, any, any, any>,
  Result extends boolean | Promise<boolean>
> = ExpandFluent<
  FluentChain<
    Result extends Promise<boolean>
      ? Promise<Awaited<This["t_current"]>>
      : This["t_current"],
    This["t_earlyOutput"],
    This["t_input"],
    This["meta"],
    This["fluentMethods"]
  >
>;

export type Transform<
  This extends FluentPipeline<any, any, any, any, any>,
  ChainedData
> = ExpandFluent<
  FluentChain<
    This["t_current"] extends Promise<any>
      ? Promise<Awaited<ChainedData>>
      : ChainedData,
    This["t_earlyOutput"],
    This["t_input"],
    This["meta"],
    This["fluentMethods"]
  >
>;

export type ShortCircuitResult<
  This extends FluentPipeline<any, any, any, any, any>,
  Keep extends This["t_innerData"],
  Abort
> = ExpandFluent<
  FluentChain<
    Exclude<
      This["t_current"] extends Promise<any>
        ? Promise<Awaited<Keep>>
        : Awaited<Keep>,
      Abort
    >,
    void extends This["t_earlyOutput"] ? Abort : This["t_earlyOutput"] | Abort,
    void extends This["t_input"] ? Abort | void : This["t_input"],
    This["meta"],
    This["fluentMethods"]
  >
>;

export type RunOutput<This extends FluentPipeline<any, any, any, any, any>> =
  TerminalOutput<This["t_current"], This["t_earlyOutput"]>;

export type UpdateMeta<
  This extends FluentPipeline<any, any, any, any, any>,
  NewMeta extends {}
> = ExpandFluent<
  FluentChain<
    This["t_current"],
    This["t_earlyOutput"],
    This["t_input"],
    Merge<This["meta"], NewMeta>,
    This["fluentMethods"]
  >
>;

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
  ): Transform<this, ChainedData> {
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
  ): ShortCircuitResult<this, Keep, Abort> {
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

  protected runFluentPipeline(input: any): RunOutput<this> {
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
  ): Check<this, Result> {
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
  ): CheckType<this, CheckedType> {
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

  protected updateMeta<const NewMeta extends {}>(
    meta: NewMeta
  ): UpdateMeta<this, NewMeta> {
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
    Merge<Meta, { pipelineType: "data-first"; fluentInput: Data }>,
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
        pipelineType: "data-last";
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
