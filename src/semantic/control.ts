import * as ast from "../parser/ast";
import { log } from "../util";
import { isUnit, SymbolTableImpl, Type } from "./info";

export type CtrlBase = {
    parent?: ast.ASTNode
    who: ast.ASTNode
}
export type ControlInfo = CtrlFn | (CtrlBase & { kind: undefined })
export interface CtrlFn extends CtrlBase {
    kind: "fn"
    returned: boolean
}

// The original Omit<T, K> does not produce union type when T is union type
type OmitDist<T, K extends keyof any> = T extends any ? Pick<T, Exclude<keyof T, K>> : never;

interface Sema {
    symbolTable: SymbolTableImpl
    reportError: (message: string, node?: ast.ASTNode) => void
    analyzeType: (type: ast.Type) => Type
    inferExprType: (expr: ast.Expr) => Type
    typeCastable(dest: Type, src: Type): boolean
}

export class Control {
    constructor(private sema: Sema) { }
    private memo = new Map<ast.ASTNode, ControlInfo>
    private _parentStack: ast.ASTNode[] = []
    private prepare(node: ast.ASTNode, call: () => OmitDist<OmitDist<ControlInfo, "who">, "parent"> | undefined) {
        if (!this.memo.has(node)) {
            const r = call()
            r && this.memo.set(node, { ...r, who: node, parent: this._parentStack.length ? this._parentStack[this._parentStack.length - 1]! : undefined })
        }
        this._parentStack.push(node)
    }
    private done() { this._parentStack.pop() }
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
    onFnPre(node: ast.FuncItem) {
        this.prepare(node, () => ({ kind: "fn", returned: false }))
    }
    onFnPost(node: ast.FuncItem) {
        if (!(this.memo.get(node) as CtrlFn).returned
            && (!node.body || !node.body.expr)
            && !isUnit(this.sema.analyzeType(node.returnType))
        )
            this.sema.reportError(`Function ${node.name} doesn't return`, node)
        this.done()
    }
    onReturnExprPre(node: ast.NodeByKind<ast.ASTType.ReturnExpr>) {
        this.prepare(node, () => ({ kind: undefined }))
    }
    onReturnExprPost(node: ast.NodeByKind<ast.ASTType.ReturnExpr>) {
        const r = this.inspect(node).find(val => {
            if (val?.kind == "fn") {
                val.returned = true
                const retType = this.sema.analyzeType((val.who as ast.FuncItem).returnType)
                if (node.expr
                    ? !this.sema.typeCastable(retType, this.sema.inferExprType(node.expr))
                    : !isUnit(retType))
                    this.sema.reportError("Unmatched return type", node)
                return true
            }
        })
        this.done()
        if (!r)
            return this.sema.reportError(`return statement outside function`, node)
    }
}
