import { UUID } from "./util";

export type UUID = string
export type SymbolTable = Record<string, UUID>

export type TypeT = Record<UUID, MetaData>
export type MetaData = {};