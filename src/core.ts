import { Merge, OverloadToTuple, UnionToIntersection } from "./typeUtils";
import { FluentError } from "./errors";

export type NoData = void;

export type AnyTransformFunction = <
  This extends FluentPipeline<any, any, any, any>
>(
  this: This,
  ...args: any[]
) => void;

export interface TransformObject extends Record<string, AnyTransformFunction> {}

export type TransformData<T> = Awaited<
  ThisParameterType<T> extends FluentPipeline<infer Data, any, any, any>
    ? Data
    : never
>;

type TransformTransforms<T> = ThisParameterType<T> extends FluentPipeline<
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

export class FluentPipeline<
  Output,
  Input,
  Meta extends {},
  Transforms extends TransformObject
> {
  constructor(
    public __outputType: Output,
    public __inputType: Input,
    public meta: Meta,
    public __transforms: Transforms,
    protected pipelineSteps: Function[]
  ) {
    Object.entries(__transforms).forEach(([key, value]) => {
      // @ts-ignore
      this[key] = value;
    });
  }

  public transform<const ChainedData>(
    func: (input: Awaited<FluentData<this>>) => ChainedData
  ): FluentChain<
    this["__outputType"] extends Promise<any>
      ? Promise<Awaited<ChainedData>>
      : ChainedData,
    this["__inputType"],
    this["meta"],
    this["__transforms"]
  > {
    const nextPipeline = [
      ...this.pipelineSteps,
      (data: any) => (data instanceof Promise ? data.then(func) : func(data)),
    ];
    return makeFluentPipeline(
      undefined,
      [],
      this.meta,
      this.__transforms,
      nextPipeline
    ) as any;
  }

  public check<Result extends boolean | Promise<boolean>>(
    checker: (input: FluentData<this>) => Result,
    message?:
      | string
      | ((meta: this["meta"], val: this["__outputType"]) => string),
    errorCode?: string
  ): FluentChain<
    Result extends Promise<boolean>
      ? Promise<FluentData<this>>
      : this["__outputType"],
    this["__inputType"],
    this["meta"],
    this["__transforms"]
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
  ): FluentChain<CheckedType, CheckedType, this["meta"], this["__transforms"]> {
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
    this["__outputType"],
    this["__inputType"],
    Merge<this["meta"], NewMeta>,
    this["__transforms"]
  > {
    return makeFluentPipeline(
      this.__outputType,
      this.__inputType,
      { ...this.meta, ...meta },
      this.__transforms,
      this.pipelineSteps
    ) as any;
  }
}

export type FluentChain<
  Output,
  Input,
  Meta extends {},
  Transforms extends TransformObject
> = FluentPipeline<Output, Input, Meta, Transforms> &
  TransformsForDataType<Transforms, Output>;

export type AnyFluentChain = FluentPipeline<any, any, any, any> &
  TransformObject;

const makeFluentPipeline = <
  Output,
  Input,
  Meta extends {},
  Transforms extends TransformObject
>(
  data: Output,
  input: Input,
  meta: Meta,
  transforms: Transforms,
  pipelineSteps: Function[] = []
): FluentPipeline<Output, Input, Meta, Transforms> &
  TransformsForDataType<Transforms, Output> =>
  new FluentPipeline(data, input, meta, transforms, pipelineSteps) as any;

type ExtractErrorKeys<T extends TransformObject> = UnionToIntersection<
  {
    [K in keyof T]: T[K] extends {
      errorKey: string | symbol;
      defaultErrorMessage?: string | ((...args: any[]) => string);
    }
      ? {
          [ErrorKey in T[K]["errorKey"]]: T[K]["defaultErrorMessage"];
        }
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
    unknown,
    Merge<Meta, { fluentInput: Data }>,
    Transforms
  >;
  (): FluentChain<NoData, NoData, Meta, Transforms>;
  extend<NewTransforms extends TransformObject>(
    transforms: NewTransforms
  ): FluentBuilder<
    Merge<Transforms, NewTransforms>,
    Merge<
      Meta,
      {
        errorMessages: Merge<
          Meta["errorMessages"],
          ExtractErrorKeys<NewTransforms>
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
        if ((val as any).errorKey) {
          acc[val.errorKey] = val.defaultErrorMessage;
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
  Input,
  {},
  {}
>;
export type EmptyFluent = Fluent<NoData, NoData>;
export type FluentData<FluentInstance extends Fluent> = Awaited<
  FluentInstance["__outputType"]
>;
export type FluentInput<FluentInstance extends Fluent> =
  FluentInstance["__inputType"];

export const toFluentMethod = <Data, Args extends any[], Return>(
  fn: (data: Data, ...args: Args) => Return
) => {
  return function <This extends Fluent<Data>>(this: This, ...args: Args) {
    return this.transform((data) => fn(data, ...args));
  };
};
