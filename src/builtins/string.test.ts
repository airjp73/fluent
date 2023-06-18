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
  expectType<string>(e().string().minChars(5).validate("foo123")).toEqual(
    "foo123"
  );
  expect(() => e().label("Foo").string().minChars(5).validate("foo")).toThrow(
    "Foo must be at least 5 characters"
  );
  expect(() => e().string().minChars(5).validate("foo")).toThrow(
    "Must be at least 5 characters"
  );
  expect(() => e().string().minChars(5, "Custom").validate("foo")).toThrow(
    "Custom"
  );
});

it("should validate max length", () => {
  expectType<string>(e().string().maxChars(5).validate("foo")).toEqual("foo");
  expect(() =>
    e().label("Foo").string().maxChars(5).validate("foo123")
  ).toThrow("Foo must be no more than 5 characters");
  expect(() => e().string().maxChars(5).validate("foo123")).toThrow(
    "Must be no more than 5 characters"
  );
  expect(() => e().string().maxChars(5, "custom").validate("foo123")).toThrow(
    "custom"
  );
});
