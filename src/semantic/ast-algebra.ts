export interface Expr<A, Visitor> {
    accept(v: Visitor): A
}

export class Block<A, Visitor extends {
    block(stmts: Expr<A, Visitor>[]): A
}> implements Expr<A, Visitor> {
    constructor(readonly stmts: Expr<A, Visitor>[]) {}
    accept(v: Visitor): A { return v.block(this.stmts) }
}

export class If<A, Visitor extends {
    ifE(cond: Expr<A, Visitor>, then: Block<A, Visitor>, elseE?: Block<A, Visitor>): A
    block(stmts: Expr<A, Visitor>[]): A
}> implements Expr<A, Visitor> {
    constructor(readonly cond: Expr<A, Visitor>, readonly then: Block<A, Visitor>, readonly elseE?: Block<A, Visitor>) {}
    accept(v: Visitor): A { return v.ifE(this.cond, this.then, this.elseE) }
}

export class Const<A, Visitor extends {
    constE(val: string): A
}> implements Expr<A, Visitor> {
    constructor(readonly val: string) {}
    accept(v: Visitor): A { return v.constE(this.val) }
}

export interface ExprAlgebraNoIf<A> {
    block(stmts: Expr<A, ExprAlgebraNoIf<A>>[]): A
    constE(val: string): A
}

class PrinterNoIf implements ExprAlgebraNoIf<string> {
    constructor(public depth = 0, public indent = '  ') {}
    block(stmts: Expr<string, ExprAlgebraNoIf<string>>[]): string {
        this.depth++
        const ret = stmts.map(v => v.accept(this)).join('\n')
        this.depth--
        return `{\n${ret}\n}`
    }
    constE(val: string): string {
        return this.indent.repeat(this.depth) + val
    }
}

export interface ExprAlgebra<A> {
    block(stmts: Expr<A, ExprAlgebra<A>>[]): A
    constE(val: string): A
    ifE(cond: Expr<A, ExprAlgebra<A>>, then: Expr<A, ExprAlgebra<A>>, elseE?: Expr<A, ExprAlgebra<A>>): A
}

console.log(new Block<string, ExprAlgebraNoIf<string>>([new Const('simple'), new Const('test')]).accept(new PrinterNoIf()))

class Printer implements ExprAlgebra<string> {
    constructor(public depth = 0, public indenter = '  ') {}
    private indent(s: string) { return this.indenter.repeat(this.depth) + s }
    private condIndent(s: string) { return this.blockNewIndent ? this.indenter.repeat(this.depth) + s : s }
    blockNewIndent = true
    block(stmts: Expr<string, ExprAlgebra<string>>[]): string {
        this.depth++
        const ret = this.flet(true, ()=>stmts.map(v => v.accept(this)).join('\n'))
        this.depth--
        return `${this.condIndent('{')}\n${ret}\n${this.indent('}')}`
    }
    constE(val: string): string {
        return this.condIndent(val)
    }
    flet = <T>(v: boolean, chunk: () => T): T => {
        const old = this.blockNewIndent
        this.blockNewIndent = v
        const ret = chunk()
        this.blockNewIndent = old
        return ret
    }
    ifE(cond: Expr<string, ExprAlgebra<string>>, then: Expr<string, ExprAlgebra<string>>, elseE?: Expr<string, ExprAlgebra<string>>): string {
        let ret = this.flet(false, () => this.indent(`if (${cond.accept(this)}) `) + then.accept(this))
        if (elseE)
            ret += ` else ` + this.flet(false, () => elseE.accept(this))
        return ret
    }
}

console.log(new Block<string, ExprAlgebra<string>>([
    new Const('extended'),
    new If(new Const('true'),
        new Block([new Const('one-side')]),
        new Block([new Const('other-side')])),
    new Const('test')]).accept(new Printer()))