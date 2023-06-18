import { expect, it } from "bun:test";
import { e } from "../preconfigured/everything";
import { expectType } from "../testUtils";
import { FluentPipeline } from "..";

it("should validate the value is a number", () => {
  const s = e().number();
  expectType<FluentPipeline<number, void, number, any, any>>(s);
  expectType<number>(s.validate(5)).toEqual(5);
  expect(() => s.validate("hello")).toThrow("Must be a number");
  expect(() => e().number("Custom").validate("hello")).toThrow("Custom");
  expect(() => e().label("Foo").number().validate("hello")).toThrow(
    "Foo must be a number"
  );
});

it("should validate lt", () => {
  const s = e().number().lt(5);
  expectType<FluentPipeline<number, void, number, any, any>>(s);
  expectType<number>(s.validate(4)).toEqual(4);
  expect(() => s.validate(5)).toThrow("Must be less than 5");
  expect(() => e().number().lt(5, "Custom").validate(6)).toThrow("Custom");
  expect(() => e().label("Foo").number().lt(5).validate(5)).toThrow(
    "Foo must be less than 5"
  );
});

it("should validate lte", () => {
  const s = e().number().lte(5);
  expectType<FluentPipeline<number, void, number, any, any>>(s);
  expectType<number>(s.validate(5)).toEqual(5);
  expectType<number>(s.validate(4)).toEqual(4);
  expect(() => s.validate(6)).toThrow("Must be no more than 5");
  expect(() => e().number().lte(5, "Custom").validate(6)).toThrow("Custom");
  expect(() => e().label("Foo").number().lte(5).validate(6)).toThrow(
    "Foo must be no more than 5"
  );
});

it("should validate gt", () => {
  const s = e().number().gt(5);
  expectType<FluentPipeline<number, void, number, any, any>>(s);
  expectType<number>(s.validate(6)).toEqual(6);
  expect(() => s.validate(5)).toThrow("Must be greater than 5");
  expect(() => e().number().gt(5, "Custom").validate(5)).toThrow("Custom");
  expect(() => e().label("Foo").number().gt(5).validate(5)).toThrow(
    "Foo must be greater than 5"
  );
});

it("should validate gte", () => {
  const s = e().number().gte(5);
  expectType<FluentPipeline<number, void, number, any, any>>(s);
  expectType<number>(s.validate(5)).toEqual(5);
  expectType<number>(s.validate(6)).toEqual(6);
  expect(() => s.validate(4)).toThrow("Must be at least 5");
  expect(() => e().number().gte(5, "Custom").validate(4)).toThrow("Custom");
  expect(() => e().label("Foo").number().gte(5).validate(4)).toThrow(
    "Foo must be at least 5"
  );
});
