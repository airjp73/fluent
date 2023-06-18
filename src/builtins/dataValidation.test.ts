import { expect, it } from "bun:test";
import { e } from "../preconfigured/everything";
import { FluentPipeline } from "../core";
import { expectType } from "../testUtils";

it("should support optional values", () => {
  const s = e().optional().string().minChars(5, "too short");

  expectType<
    FluentPipeline<
      string,
      undefined,
      string | undefined,
      { pipelineType: "data-last"; optional: true },
      any
    >
  >(s);
  expectType<string | undefined>(s.validate(undefined)).toEqual(undefined);
  expectType<string | undefined>(s.apply("hello")).toEqual("hello");
  expect(() => s.apply("hi")).toThrow("too short");

  // Can't chain optional after
  // @ts-expect-error
  const s2 = e().string().optional();
});

it("should support required errors", () => {
  const s = e().required().string();

  expectType<FluentPipeline<string, void, string, { required: true }, any>>(s);
  expectType<string>(s.validate("hello"));
  expect(() => s.validate(undefined)).toThrow(
    e.__meta.errorMessages.required({})
  );

  expect(() => e().label("foo").required().validate(undefined)).toThrow(
    e.__meta.errorMessages.required({ label: "foo" })
  );

  expect(() => e().required("Custom").validate(undefined)).toThrow("Custom");
});
