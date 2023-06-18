import { expect, it } from "bun:test";
import { e } from "../preconfigured/everything";
import { FluentPipeline } from "../core";
import { expectType } from "../testUtils";

it("should support optional values", () => {
  const s = e().optional().string().minChars(5, "too short");

  expectType<FluentPipeline<string, undefined, string | undefined, any, any>>(
    s
  );
  expectType<string | undefined>(s.apply(undefined)).toEqual(undefined);
  expectType<string | undefined>(s.apply("hello")).toEqual("hello");
  expect(() => s.apply("hi")).toThrow("too short");

  // Can't chain optional after
  // @ts-expect-error
  const s2 = e().string().optional();
});
