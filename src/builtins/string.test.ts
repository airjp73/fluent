import { expect, it } from "bun:test";
import { e } from "../preconfigured/everything";
import { expectType } from "../testUtils";
import { FluentPipeline, NoData } from "../core";

it("should succeed for strings", () => {
  const t = e().string();
  expectType<
    FluentPipeline<
      string,
      NoData,
      string,
      {
        errorMessages: Record<
          string | symbol,
          string | ((...args: any[]) => string)
        >;
      },
      any
    >
  >(t);
  expectType<string>(t.validate("hello")).toBe("hello");
});

it("should fail for non-strings", () => {
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
});

it("should validate min length", () => {
  expect(() => e().string().minLength(5).validate("foo")).toThrow(
    "Must be at least 5 characters"
  );
});
