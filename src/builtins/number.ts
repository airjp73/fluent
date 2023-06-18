import { EmptyFluent, Fluent } from "../core";

/**
 * Validates that the input is a number.
 */
function number<This extends EmptyFluent>(this: This, message?: string) {
  return this.checkType(
    (input): input is number => typeof input === "number",
    (meta: any) => message ?? meta.errorMessages.number_type(meta),
    "number_type"
  );
}
number.errors = {
  number_type: (meta: any) =>
    "label" in meta ? `${meta.label} must be a number` : "Must be a number",
};

function gte<This extends Fluent<number>>(
  this: This,
  gte: number,
  message?: string
) {
  return this.check(
    (data) => data >= gte,
    (meta: any) =>
      message ?? meta.errorMessages.greater_than_or_equal(meta, gte),
    "greater_than_or_equal"
  );
}
gte.errors = {
  greater_than_or_equal: (meta: any, gte: number) =>
    "label" in meta
      ? `${meta.label} must be at least ${gte}`
      : `Must be at least ${gte}`,
};

function gt<This extends Fluent<number>>(
  this: This,
  gt: number,
  message?: string
) {
  return this.check(
    (data) => data > gt,
    (meta: any) => message ?? meta.errorMessages.greater_than(meta, gt),
    "greater_than_or_equal"
  );
}
gt.errors = {
  greater_than: (meta: any, gt: number) =>
    "label" in meta
      ? `${meta.label} must be greater than ${gt}`
      : `Must be greater than ${gt}`,
};

function lte<This extends Fluent<number>>(
  this: This,
  lte: number,
  message?: string
) {
  return this.check(
    (data) => data <= lte,
    (meta: any) => message ?? meta.errorMessages.less_than_or_equal(meta, lte),
    "lte"
  );
}
lte.errors = {
  less_than_or_equal: (meta: any, lte: number) =>
    "label" in meta
      ? `${meta.label} must be no more than ${lte}`
      : `Must be no more than ${lte}`,
};

function lt<This extends Fluent<number>>(
  this: This,
  lt: number,
  message?: string
) {
  return this.check(
    (data) => data < lt,
    (meta: any) => message ?? meta.errorMessages.less_than(meta, lt),
    "lt"
  );
}
lt.errors = {
  less_than: (meta: any, lt: number) =>
    "label" in meta
      ? `${meta.label} must be less than ${lt}`
      : `Must be less than ${lt}`,
};

export { number, gte, lte, lt, gt, gte as min, lte as max };
