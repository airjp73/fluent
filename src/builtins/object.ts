import {
  CheckType,
  EmptyFluent,
  Fluent,
  FluentError,
  FluentPipeline,
  Infer,
  Transform,
} from "..";
import { MaybePromise, MaybePromiseSettledResult } from "../util/maybePromise";

type DataLastPipeline = FluentPipeline<
  any,
  any,
  any,
  { pipelineType: "data-last" },
  any
>;

export type FluentObjectShape = Record<
  string | number | symbol,
  DataLastPipeline
>;

type InferShape<Shape extends FluentObjectShape> = Promise<any> extends Infer<
  Shape[keyof Shape]
>
  ? Promise<{
      [K in keyof Shape]: Awaited<Infer<Shape[K]>>;
    }>
  : {
      [K in keyof Shape]: Infer<Shape[K]>;
    };

function processObjectShape<
  This extends Fluent,
  Shape extends FluentObjectShape
>(this: This, input: object, shape: Shape) {
  const keys = Object.keys(shape);
  const results = Object.values(shape).map((value, index) => {
    const key = keys[index];
    const propInput = (input as any)[key];
    return MaybePromise.of(() => value.runFluentPipeline(propInput));
  });
  return MaybePromise.allSettled(results).then((res) =>
    collectObjectResults(keys, res)
  );
}

function collectObjectResults(
  keys: string[],
  promiseResult: MaybePromiseSettledResult[]
) {
  const results: Record<string, any> = {};
  const errors: Record<string, FluentError> = {};

  promiseResult.map((result, index) => {
    if (result.status === "rejected") {
      const key = keys[index];
      if (result.reason instanceof FluentError) errors[key] = result.reason;
      else throw result.reason;
    } else {
      results[keys[index]] = result.value;
    }
  });

  const errorKeys = Object.keys(errors);
  if (errorKeys.length > 0) {
    throw new FluentError(
      "object_shape",
      object.errors.object_shape({}),
      [],
      Object.values(errors).map((error, index) => {
        error.prependPath(errorKeys[index]);
        return error;
      })
    );
  }

  return results as any;
}

/**
 * Validates that the input is an object matching the provided shape..
 */
function object<This extends EmptyFluent>(
  this: This,
  message?: string
): CheckType<This, NonNullable<object>>;
function object<This extends EmptyFluent, Shape extends FluentObjectShape>(
  this: This,
  shape: Shape,
  message?: string
): Transform<CheckType<This, NonNullable<object>>, InferShape<Shape>>;
function object<This extends EmptyFluent, Shape extends FluentObjectShape>(
  this: This,
  shapeOrMessage?: Shape | string,
  message?: string
) {
  if (typeof shapeOrMessage === "string" || shapeOrMessage === undefined) {
    return this.checkType(
      (input): input is NonNullable<object> =>
        typeof input === "object" || input === null,
      (meta: any) => shapeOrMessage ?? meta.errorMessages.object_type(meta),
      "object_type"
    );
  }

  return this.checkType(
    (input): input is NonNullable<object> =>
      typeof input === "object" || input === null,
    (meta: any) => message ?? meta.errorMessages.object_type(meta),
    "object_type"
  ).transform(
    (input): InferShape<Shape> =>
      processObjectShape.call(this, input, shapeOrMessage).flatten()
  );
}
object.errors = {
  object_type: (meta: any) =>
    "label" in meta ? `${meta.label} must be an object` : "Must be an object",
  object_shape: (meta: any) =>
    "label" in meta
      ? `${meta.label} has invalid properties`
      : "Has invalid properties",
};

function withCatchall<
  This extends Fluent<object>,
  Shape extends FluentObjectShape,
  IndexType extends DataLastPipeline
>(this: This, shape: Shape, indexType: IndexType) {
  return this.transform(
    (input): InferShape<Shape> & Record<string | number, Infer<IndexType>> => {
      const shapeMaybe = processObjectShape.call(this, input, shape);
      const shapeKeys = new Set(Object.keys(shape));

      const indexKeys = Object.keys(input).filter((key) => !shapeKeys.has(key));
      const indexResults = indexKeys.map((key) => {
        const propInput = (input as any)[key];
        return MaybePromise.of(() => indexType.runFluentPipeline(propInput));
      });
      const indexTypeMaybe = MaybePromise.allSettled(indexResults).then((res) =>
        collectObjectResults(indexKeys, res)
      );

      return MaybePromise.allSettled([shapeMaybe, indexTypeMaybe])
        .then(([shapeResult, indexTypeResult]) => {
          if (
            shapeResult.status === "rejected" &&
            shapeResult.reason instanceof FluentError &&
            indexTypeResult.status === "rejected" &&
            indexTypeResult.reason instanceof FluentError
          )
            throw new FluentError(
              "object_shape",
              object.errors.object_shape({}),
              [],
              [
                ...shapeResult.reason.childIssues,
                ...indexTypeResult.reason.childIssues,
              ]
            );
          if (shapeResult.status === "rejected") throw shapeResult.reason;
          if (indexTypeResult.status === "rejected")
            throw indexTypeResult.reason;

          return { ...shapeResult.value, ...indexTypeResult.value };
        })
        .flatten();
    }
  );
}

export { object, withCatchall };
