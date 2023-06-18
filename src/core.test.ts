import { describe, expect, it } from "bun:test";
import {
  EmptyFluent,
  Fluent,
  FluentPipeline,
  FluentChain,
  FluentData,
  FluentInput,
  fluent,
  toFluentMethod,
  NoData,
} from "./core";
import { expectType } from "./testUtils";
import { apply, get, validate } from "./builtins/terminals";
import { label } from "./builtins/forms";
import { e } from "./preconfigured/everything";
import { FluentError, ShortCircuit } from "./errors";

/**
 * Does this have docs, too?
 */
function concat<
  This extends Fluent<readonly any[]>,
  const Suff extends readonly any[]
>(
  this: This,
  suff: Suff
): FluentChain<
  [...FluentData<This>, ...Suff],
  This["t_earlyOutput"],
  FluentInput<This>,
  This["meta"],
  This["fluentMethods"]
>;
function concat<This extends Fluent<string>, Suff extends string>(
  this: This,
  suff: Suff
): FluentChain<
  `${FluentData<This>}${Suff}`,
  This["t_earlyOutput"],
  FluentInput<This>,
  This["meta"],
  This["fluentMethods"]
>;
function concat(
  this: Fluent<string | readonly any[]>,
  suff: string | readonly any[]
): Fluent<string | readonly any[]> {
  return this.transform((data) => {
    if (Array.isArray(data)) return [...data, ...suff] as const;
    if (typeof data === "string") return `${data}${suff}`;
    throw new Error("Invalid type to concat");
  });
}
function add<This extends Fluent<number>>(this: This, b: number) {
  return this.transform((a) => a + b);
}
function subtract<This extends Fluent<number>>(this: This, b: number) {
  return this.transform((a) => a - b);
}
function numToString<This extends Fluent<number>>(this: This) {
  return this.transform((d) => d.toString());
}
function stringToNum<This extends Fluent<string>>(this: This) {
  return this.transform((d) => Number(d));
}
function promisify<This extends Fluent<unknown>>(this: This) {
  return this.transform((data) => Promise.resolve(data));
}

export function earlyReturnNumber<This extends Fluent<string | number>>(
  this: This
) {
  return this.shortCircuit((input) => {
    if (typeof input === "number") return new ShortCircuit(input);
    return input;
  });
}

function num<This extends EmptyFluent>(this: This) {
  return this.checkType(
    (input): input is number => typeof input === "number",
    (meta: any) => `${meta.label} must be a number`
  );
}

it("should create an api and use it", () => {
  const f = fluent.extend({
    add,
    subtract,
    get,
    num,
  });

  const res = f(1).add(5).subtract(2).get();
  expectType<number>(res).toEqual(4);

  // Should not have num in the types because a type is defined
  // @ts-expect-error
  f(1).num();
});

it("should be able to continue chaining after a type change", () => {
  const f = fluent.extend({
    stringToNum,
    numToString,
    concat,
    add,
    get,
  });

  const res = f("1").stringToNum().add(5).numToString().concat("2").get();
  expectType<string>(res).toEqual("62");
});

it("should have type errors if you try to chain the wrong things", () => {
  const f = fluent.extend({
    stringToNum,
    numToString,
    concat,
    add,
    get,
  });

  // @ts-expect-error
  expect(() => f("1").stringToNum().concat("2").get()).toThrow();

  // Technically these will still "work", but they will have type errors
  expect(
    // @ts-expect-error
    f("1").add(1).get()
  ).toEqual("11");
  expect(
    // @ts-expect-error
    f("1").numToString().get()
  ).toEqual("1");
});

it("should correctly type more advanced transforms", () => {
  const f = fluent.extend({
    numToString,
    stringToNum,
    get,
  });

  const step1 = f("1")
    .transform((x) => `${x}1`)
    .stringToNum();
  expectType<Fluent<number>>(step1);
  expectType<number>(step1.get()).toEqual(11);

  const step2 = step1.transform((x) => x + 1).numToString();
  expectType<Fluent<string>>(step2);
  expectType<string>(step2.get()).toEqual("12");

  const step3 = step2.transform((x) => [x] as const);
  expectType<Fluent<readonly [string]>>(step3);
  expectType<readonly [string]>(step3.get()).toEqual(["12"]);

  const step4 = step3.transform((x) => x.map((y) => Number(y)));
  expectType<Fluent<number[]>>(step4);
  expectType<number[]>(step4.get()).toEqual([12]);
});

it("should correctly type overloaded functions", () => {
  const f = fluent.extend({
    concat,
    stringToNum,
    get,
  });

  const res = f("1")
    .concat("2")
    .transform((x) => [x] as const)
    .concat(["3"])
    .transform(([x, y]) => `${x}${y}` as const)
    .concat("4");
  expectType<Fluent<"1234">>(res);
  expectType<"1234">(res.get()).toEqual("1234");

  // @ts-expect-error
  expect(() => f(1).concat(2).get()).toThrow();
});

it("should properly filter methods when Data is a nested type", () => {
  const f = fluent.extend({
    toB<This extends Fluent<{ nested: "a" }>>(this: This) {
      return this.transform(() => ({ nested: "b" }));
    },
    toA<This extends Fluent<{ nested: "b" }>>(this: This) {
      return this.transform(() => ({ nested: "a" }));
    },
    get,
  })<{
    nested: "a";
  }>;
  const res = f({ nested: "a" });

  // @ts-expect-error
  res.toA();

  // @ts-expect-error
  res.toB().toB();

  expect(res.toB().toA().get()).toEqual({ nested: "a" });
  expect(res.toB().toA().toB().get()).toEqual({ nested: "b" });
  expect(res.toB().get()).toEqual({ nested: "b" });
});

it("should be able to chain transforms", () => {
  const f = fluent.extend({ apply, num });
  const validator = f()
    .num()
    .transform((val) => val - 5)
    .transform((a) => a + 2);
  expectType<number>(validator.apply(123)).toEqual(120);
});

it("should continue to chain when dealing with promises", async () => {
  const f = fluent.extend({
    promisify,
    add,
    get,
  });

  const res = f(1).add(1).promisify().add(5).get();
  expectType<Promise<number>>(res).toBeInstanceOf(Promise);
  expectType<number>(await res).toEqual(7);
});

it("should be able to create a lazy pipeline instead of immediately executing", () => {
  const f = fluent.extend({
    add,
    numToString,
    concat,
    get,
    apply,
    num,
  });

  const res = f().num().add(1).numToString().concat("2");
  expectType<Fluent<`${string}2`, unknown>>(res);
  expectType<`${string}2`>(res.apply(2)).toEqual("32");

  // Shouldn't have datatype methods if the input type is never
  // @ts-expect-error
  const r = f().add(1);

  // @ts-expect-error
  expect(() => res.get()).toThrow();

  // Should not be able to declare twice in a row
  // @ts-expect-error
  f().num().num();
});

it("should support tracking meta", () => {
  const f = fluent.extend({
    label,
    get,
    add,
  });
  const res = f(1).label("test").add(1);
  expectType<
    FluentPipeline<number, void, number, { label: "test"; fluentInput: 1 }, any>
  >(res);
  expectType<number>(res.get()).toEqual(2);
});

it("should lock-in meta attributes statically", () => {
  const f = fluent.extend({
    num,
    apply,
    label,
  });
  const validator = f()
    .num()
    .label("foo")
    .check(
      (a) => a > 5,
      (meta) => meta.label
    )
    .label("bar")
    .check(
      (a) => a < 10,
      (meta) => meta.label
    )
    .label("baz");
  expectType<FluentPipeline<number, NoData, unknown, { label: "baz" }, any>>(
    validator
  );
  expectType<number>(validator.apply(7)).toEqual(7);
  expectType(() => validator.apply(1)).toThrow("foo");
  expectType(() => validator.apply(11)).toThrow("bar");
});

it("should support chaining with promises", async () => {
  const f = fluent.extend({ validate });
  const validator = f()
    .transform(() => Promise.resolve(123))
    .transform((a) => a + 2);
  expectType<number>(await validator.validate(123)).toEqual(125);
});

it("should support chaining checks with promises", async () => {
  const f = fluent.extend({ apply, num, add });
  const validator = f()
    .num()
    .check((a) => a > 5, "Must be greater than 5")
    .check(() => Promise.resolve(true))
    .check((a) => a < 10, "Must be less than 10");

  expect(() => validator.apply(4)).toThrow("Must be greater than 5");

  const validRes = validator.apply(6);
  expectType<Promise<number>>(validRes);
  expectType<number>(await validRes).toEqual(6);

  const invalidRes = validator.apply(11);
  expectType<Promise<number>>(invalidRes);
  expect(() => invalidRes).toThrow("Must be less than 10");
});

it("should be able to customize error handlers", () => {
  expect(() => e().string().validate(5)).toThrow("Must be a string");
  expect(() => e().label("Foo").string().validate(Symbol())).toThrow(
    "Foo must be a string"
  );
  expect(() => e().string("Please give string").validate({})).toThrow(
    "Please give string"
  );
  expect(() => e().string("Please give string").validate({})).toThrow(
    "Please give string"
  );

  const custom = e.customizeErrors({
    string_type: (meta) => `${meta.label} has a custom error!`,
  });

  expect(() => custom().label("Foo").string().label("Bar").validate(5)).toThrow(
    "Foo has a custom error!"
  );
});

it("should throw FluentErrors when validations fail", () => {
  const validator = e().string().minLength(5);

  // `toThrow` won't check the `code` property, so we have to do this
  const getError = (func: () => any) => {
    try {
      func();
    } catch (err) {
      return err;
    }
  };

  expect(getError(() => validator.validate("foo"))).toEqual(
    new FluentError(
      e.__transforms.minLength.errorKey,
      e.__transforms.minLength.defaultErrorMessage({}, 5)
    )
  );

  expect(getError(() => validator.validate(1))).toEqual(
    new FluentError(
      e.__transforms.string.errorKey,
      e.__transforms.string.defaultErrorMessage({})
    )
  );
});

it("should be able to perform short-circuit evaluation", () => {
  const v = e.extend({ earlyReturnNumber, concat });
  const res = v("hi" as "hi" | number)
    .earlyReturnNumber()
    .concat(" world");

  expectType<FluentPipeline<"hi world", number, "hi" | number, {}, any>>(res);
  expectType<"hi world" | number>(res.get()).toEqual("hi world");

  const res2 = v("hi" as string | number)
    .earlyReturnNumber()
    .concat(" world");
  expectType<FluentPipeline<string, number, string | number, {}, any>>(res2);
  expectType<string | number>(res2.get()).toEqual("hi world");

  const res3 = v(123 as string | number)
    .earlyReturnNumber()
    .concat(" world");
  expectType<FluentPipeline<string, number, string | number, {}, any>>(res3);
  expectType<string | number>(res3.get()).toEqual(123);
});

describe("toFluentMethod", () => {
  it("should transform regular functions into fluent methods", () => {
    const add = toFluentMethod((a: number, b: number) => a + b);
    const f = fluent.extend({ add, get });
    const res = f(1).add(2).get();
    expectType<number>(res).toEqual(3);
  });
});
