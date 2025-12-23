import * as ast from "../parser/ast";
import { log } from "../util";
import { isUnit, neverType, SymbolTableImpl, Type, unitType } from "./info";

export type CtrlBase = {
    parent?: ast.ASTNode
    who: ast.ASTNode
}
export type ControlInfo =
    CtrlFn
    | CtrlFnBlock
    | CtrlBlock
    | CtrlLoop
    | (CtrlBase & { kind: undefined })
export interface CtrlFn extends CtrlBase {
    kind: "fn"
    returned: boolean
}
export interface CtrlFnBlock extends CtrlBase {
    kind: "fnBlock"
}
export interface CtrlBlock extends CtrlBase {
    kind: "block"
    never: boolean
}
export interface CtrlLoop extends CtrlBase {
    kind: "loop"
    types: Type[]
    type: Type
}

// The original Omit<T, K> does not produce union type when T is union type
type OmitDist<T, K extends keyof any> = T extends any ? Pick<T, Exclude<keyof T, K>> : never;

interface Sema {
    symbolTable: SymbolTableImpl
    reportError: (message: string, node?: ast.ASTNode) => void
    analyzeType: (type: ast.Type) => Type
    inferExprType: (expr: ast.Expr) => Type
    typeCastable(dest: Type, src: Type): boolean
    unifyType: (u: Type, v: Type) => Type | null
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
    private inspect(node?: ast.ASTNode): ControlInfo[] {
        const ret: ControlInfo[] = []
        if (!node && this._parentStack.length)
            node = this._parentStack[this._parentStack.length - 1]
        while (node) {
            const m = this.memo.get(node)
            m && ret.push(m)
            node = m?.parent
        }
        return ret
    }
    ask(node: ast.ASTNode): ControlInfo | undefined { return this.memo.get(node) }
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
    onBlockPre(node: ast.BlockExpr) {
        const stack = this.inspect()
        if (stack.length && stack[0]?.kind == "fn")
            this.prepare(node, () => ({ kind: "fnBlock" }))
        else
            this.prepare(node, () => ({ kind: "block", never: false }))
    }
    onBlockPost(node: ast.BlockExpr) {
        try {
            if (this.memo.get(node)?.kind == "fnBlock") {
                const stack = this.inspect(node)
                const fnInfo = stack[1] as ControlInfo & { kind: "fn" }
                const fn = fnInfo?.who as ast.FuncItem
                if (fn?.body !== node)
                    throw new Error(`Unexpected error: fn doesn't match with block`)
                if (fn.body
                    && fn.body.expr
                    && !this.sema.typeCastable(this.sema.analyzeType(fn.returnType), this.sema.inferExprType(fn.body.expr)))
                    this.sema.reportError("Unmatched return expr type", fn)
            }
        } finally {
            this.done()
        }
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
    onLoopPre(node: ast.LoopExpr) {
        this.prepare(node, () => ({ kind: "loop", types: [], type: neverType() }))
    }
    onLoopPost(node: ast.LoopExpr) {
        const info = this.memo.get(node) as CtrlLoop
        if (info.types.length)
            info.type =
                (info.types as (Type | null)[])
                    .reduce((u, v) => u && v && this.sema.unifyType(u, v))
                || neverType()
        this.done()
    }
    onBreakPost(node: ast.BreakExpr) {
        const lp = this._parentStack.length ? this.inspect().find(v => v.kind == "loop") : undefined
        if (!lp) {
            // this.sema.reportError("break outside loop expr")  // this should already be reported in semantic
            return
        }
        if (node.expr)
            lp.types.push(this.sema.inferExprType(node.expr))
        else
            lp.types.push(unitType())
    }
}
