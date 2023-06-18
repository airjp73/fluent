import {
  Merge,
  MergeIntersection,
  OverloadToTuple,
  UnionToIntersection,
} from "./typeUtils";
import { FluentError, ShortCircuit } from "./errors";

export type NoData = void;

export type AnyTransformFunction = <
  This extends FluentPipeline<any, any, any, any, any>
>(
  this: This,
  ...args: any[]
) => void;

export interface TransformObject extends Record<string, AnyTransformFunction> {}

export type TransformData<T> = Awaited<
  ThisParameterType<T> extends FluentPipeline<infer Data, any, any, any, any>
    ? Data
    : never
>;

type TransformTransforms<T> = ThisParameterType<T> extends FluentPipeline<
  any,
  any,
  any,
  any,
  infer Transforms
>
  ? Transforms
  : never;

export type DataTypeMatchesTransform<
  Transform extends AnyTransformFunction,
  DataType
> = DataType extends NoData
  ? TransformData<Transform> extends unknown
    ? true
    : false
  : Awaited<DataType> extends TransformData<OverloadToTuple<Transform>>
  ? true
  : false;

type TransformKeysAcceptingDataType<
  Transforms extends TransformObject,
  DataType
> = {
  [K in keyof Transforms]: DataTypeMatchesTransform<
    Transforms[K],
    DataType
  > extends true
    ? Transforms extends TransformTransforms<OverloadToTuple<Transforms[K]>>
      ? K
      : never
    : never;
}[keyof Transforms];

type TransformsForDataType<Transforms extends TransformObject, DataType> = {
  [K in TransformKeysAcceptingDataType<Transforms, DataType>]: Transforms[K];
};

type TerminalOutput<Output, EarlyOutput> = Output extends Promise<any>
  ? Promise<Awaited<EarlyOutput> | Awaited<Output>>
  : Output | EarlyOutput;

export class FluentPipeline<
  Output,
  EarlyOutput,
  Input,
  Meta extends {},
  Transforms extends TransformObject
> {
  public t_innerData: Awaited<this["t_output"]>;

  constructor(
    public t_output: Output,
    public t_earlyOutput: EarlyOutput,
    public t_input: Input,
    public meta: Meta,
    public fluentMethods: Transforms,
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
    this["t_output"] extends Promise<any>
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
      this["t_output"] extends Promise<any>
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

  protected runFluentPipeline(input: any): TerminalOutput<Output, EarlyOutput> {
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
    checker: (input: Awaited<Output>) => Result,
    message?: string | ((meta: this["meta"], val: this["t_output"]) => string),
    errorCode?: string
  ): FluentChain<
    Result extends Promise<boolean>
      ? Promise<Awaited<this["t_output"]>>
      : this["t_output"],
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
    this["t_output"],
    this["t_earlyOutput"],
    this["t_input"],
    Merge<this["meta"], NewMeta>,
    this["fluentMethods"]
  > {
    return makeFluentPipeline(
      this.t_output,
      this.t_earlyOutput,
      this.t_input,
      { ...this.meta, ...meta },
      this.fluentMethods,
      this.pipelineSteps
    ) as any;
  }
}

export type FluentChain<
  Output,
  EarlyOutput,
  Input,
  Meta extends {},
  Transforms extends TransformObject
> = FluentPipeline<Output, EarlyOutput, Input, Meta, Transforms> &
  TransformsForDataType<Transforms, Output>;

export type AnyFluentChain = FluentPipeline<any, any, any, any, any> &
  TransformObject;

const makeFluentPipeline = <
  Output,
  EarlyOutput,
  Input,
  Meta extends {},
  Transforms extends TransformObject
>(
  data: Output,
  earlyOutput: EarlyOutput,
  input: Input,
  meta: Meta,
  transforms: Transforms,
  pipelineSteps: Function[] = []
): FluentPipeline<Output, EarlyOutput, Input, Meta, Transforms> &
  TransformsForDataType<Transforms, Output> =>
  new FluentPipeline(
    data,
    earlyOutput,
    input,
    meta,
    transforms,
    pipelineSteps
  ) as any;

type ExtractErrorDefinitions<T extends TransformObject> = UnionToIntersection<
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
  Transforms extends TransformObject,
  Meta extends {
    errorMessages?: Record<string | symbol, string | ((meta: any) => string)>;
  }
> {
  __transforms: Transforms;
  __meta: Meta;
  <const Data>(data: Data): FluentChain<
    Data,
    NoData,
    Data,
    Merge<Meta, { fluentInput: Data }>,
    Transforms
  >;
  (): FluentChain<NoData, NoData, NoData, Meta, Transforms>;
  extend<NewTransforms extends TransformObject>(
    transforms: NewTransforms
  ): FluentBuilder<
    Merge<Transforms, NewTransforms>,
    Merge<
      Meta,
      {
        errorMessages: Merge<
          Meta["errorMessages"],
          ExtractErrorDefinitions<NewTransforms>
        >;
      }
    >
  >;
  customizeErrors<
    NewErrorMessages extends Partial<Default<Meta["errorMessages"], {}>>
  >(
    newErrorMessages: NewErrorMessages
  ): FluentBuilder<
    Transforms,
    Merge<
      Meta,
      {
        errorMessages: Merge<Meta["errorMessages"], NewErrorMessages>;
      }
    >
  >;
}

const makeFluentBuilder = <
  const Transforms extends TransformObject,
  Meta extends {}
>(
  transforms: Transforms,
  meta: Meta
): FluentBuilder<Transforms, Meta> => {
  function builder(maybeData?: any) {
    return new FluentPipeline(
      undefined,
      undefined,
      undefined,
      {
        ...meta,
        fluentInput: maybeData,
      },
      transforms,
      []
    ) as any;
  }
  builder.__transforms = transforms;
  builder.__meta = meta;
  builder.extend = (newTransforms: TransformObject) => {
    const transformErrorMessages = Object.values(newTransforms).reduce(
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
        ...transforms,
        ...newTransforms,
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
    return makeFluentBuilder(transforms, {
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

export type Fluent<Output = any, Input = any> = FluentPipeline<
  Output | Promise<Output>,
  unknown,
  Input,
  {},
  {}
>;
export type EmptyFluent = Fluent<NoData, NoData>;
export type FluentData<
  FluentInstance extends FluentPipeline<any, any, any, any, any>
> = Awaited<FluentInstance["t_output"]>;
export type FluentInput<FluentInstance extends Fluent> =
  FluentInstance["t_input"];

export const toFluentMethod = <Data, Args extends any[], Return>(
  fn: (data: Data, ...args: Args) => Return
) => {
  return function <This extends Fluent<Data>>(this: This, ...args: Args) {
    return this.transform((data) => fn(data, ...args));
  };
};
