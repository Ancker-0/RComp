import { ASTNode, ASTType, getChildren, NodeByKind, visit, Visitor, walk } from "../parser/ast"
import { SymbolTable } from "./info"

export type resolvedType = any
export type Evaluated = {
    type: resolvedType
    value: any
}

export class ConstEvaluator implements Visitor {
    constructor(private symbolTable?: SymbolTable) {}
    onLiteralExpr(node: NodeByKind<ASTType.LiteralExpr>, self: Visitor) {
        node.evaluated = {
            type: node.type,
            value: node.value,
        }
        
        // 处理整数字面量
        if (node.type === "integer") {
            node.evaluated.value = parseInt(node.value, 10);
        }
    }
    
    onBinaryExpr(node: NodeByKind<ASTType.BinaryExpr>, self: Visitor): void {
        visit(node.operand[0], self);
        visit(node.operand[1], self);
        
        if (!node.operand[0].evaluated || !node.operand[1].evaluated) {
            return;
        }
        
        const left = node.operand[0].evaluated.value;
        const right = node.operand[1].evaluated.value;
        
        switch (node.operator) {
            case "+":
                node.evaluated = {
                    type: "integer",
                    value: left + right
                };
                break;
            case "-":
                node.evaluated = {
                    type: "integer",
                    value: left - right
                };
                break;
            case "*":
                node.evaluated = {
                    type: "integer",
                    value: left * right
                };
                break;
            case "/":
                node.evaluated = {
                    type: "integer",
                    value: Math.floor(left / right)
                };
                break;
            default:
                throw new Error(`Unexpected binary operator ${node.operator}`);
        }
    }
    
    onUnaryExpr(node: NodeByKind<ASTType.UnaryExpr>, self: Visitor<void>): void {
        visit(node.operand, self);
        
        if (!node.operand.evaluated) {
            return;
        }
        
        const value = node.operand.evaluated.value;
        
        switch (node.operator) {
            case "-":
                node.evaluated = {
                    type: "integer",
                    value: -value
                };
                break;
            default:
                throw new Error(`Unexpected unary operator ${node.operator}`);
        }
    }
    
    onPathExpr(node: NodeByKind<ASTType.PathExpr>, self: Visitor): void {
        // Try to resolve constant values from symbol table
        if (this.symbolTable && node.segs.length === 1) {
            const name = node.segs[0]!;
            const varSymbol = this.symbolTable.lookupVariable(name);

            // If it's a constant with an evaluated value, propagate it
            if (varSymbol && !varSymbol.mutable && varSymbol.evaluated) {
                node.evaluated = varSymbol.evaluated;
            }
        }
        // PathExpr has no children, so nothing to do here
    }
    
    onCallExpr(node: NodeByKind<ASTType.CallExpr>, self: Visitor) {
        walk(node, self);
    }
    
    onFn(node: NodeByKind<ASTType.FnItem>, self: Visitor<void>): void {
        walk(node, self);
    }
    
    onBlock(node: NodeByKind<ASTType.BlockExpr>, self: Visitor<void>): void {
        const blocks = node.statements.filter(stmt => stmt.kind === ASTType.ConstItem);
        blocks.forEach(item => {
            if (!item.val)
                throw new Error("Constant must be initialized with some expression");
            visit(item.val, self);
        });
    }
    
    onCrateExpr(node: ASTNode, self: Visitor) {
        walk(node, self);
    }
    
    default(node: ASTNode, self: Visitor<void>): void {
        // 对于不支持的节点类型，不设置 evaluated 属性
        walk(node, self);
    }
}

// Evaluate expression value
export function evaluateExpr(node: ASTNode, symbolTable?: SymbolTable): Evaluated | undefined {
    const evaluator = new ConstEvaluator(symbolTable);
    visit(node, evaluator);
    return (node as any).evaluated;
}

// visit({ kind: ASTType.LiteralExpr, type: "string", value: "123" }, new ConstEvaluator())