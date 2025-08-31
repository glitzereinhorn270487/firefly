import { register } from "./registry";
import { demoRule } from "./examples/demoRule";

// Registrierung der eingebauten Rules
register(demoRule);

export * as Registry from "./registry";
export * from "./types";
