import * as ast from "../parser/ast";
import { log } from "../util";
import { SymbolTableImpl } from "./info";

export type CtrlBase = {
    parent?: ast.ASTNode
    who: ast.ASTNode
}
export type ControlInfo = CtrlFn | (CtrlBase & { kind: undefined })
export interface CtrlFn extends CtrlBase {
    kind: "fn"
}

export class Control implements ast.Visitor<void> {
    constructor(
        private symbolTable: SymbolTableImpl,
        private reportError: (message: string, node?: ast.ASTNode) => void) { }
    private memo = new Map<ast.ASTNode, ControlInfo>
    private prepare = (node: ast.ASTNode, call: () => Omit<ControlInfo, "who"> | undefined) => {
        if (!this.memo.has(node)) {
            const r = call()
            r && this.memo.set(node, { ...r, who: node })
        }
        this._parentNow = node
    }
    private _parentNow?: ast.ASTNode
    private inspect(node: ast.ASTNode | undefined): ControlInfo[] {
        const ret: ControlInfo[] = []
        while (node) {
            const m = this.memo.get(node)
            m && ret.push(m)
            node = m?.parent
        }
        return ret
    }
    // private wrap<R extends any>(fn: (node: ast.FuncItem, self: ast.Visitor<void>) => R): (node: ast.FuncItem, self: ast.Visitor<void>) => R {
    //     return (node: ast.FuncItem, self: ast.Visitor<void>) => {
    //         this.prepare(node, () => ({ parent: this._parentNow }))
    //         return fn(node, self);
    //     }
    // }
    onFn(node: ast.FuncItem, self: ast.Visitor<void>): void {
        this.prepare(node, () => ({ kind: "fn", parent: this._parentNow }))
        ast.walk(node, self)
    }
    onReturnExpr(node: ast.NodeByKind<ast.ASTType.ReturnExpr>, self: ast.Visitor<void>): void {
        this.prepare(node, () => ({ kind: undefined, parent: this._parentNow }))
        ast.walk(node, self)
        const r = this.inspect(node).find(val => {
            if (val?.kind == "fn") {
                return true
            }
        })
        if (!r)
            return this.reportError(`return statement outside function`, node)
    }
    onCrate(node: ast.NodeByKind<ast.ASTType.Crate>, self: ast.Visitor<void>): void {
        ast.walk(node, self)
    }
    default(node: ast.ASTNode, self: ast.Visitor<void>): void {
        ast.walk(node, self)
    }
}
