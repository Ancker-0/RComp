import { SymbolTableImpl, SemanticError, VariableSymbol, TypeSymbol, i32Type, boolType } from "./info";
import { genUUID } from "./util";

describe("SymbolTable", () => {
  let symbolTable: SymbolTableImpl;

  beforeEach(() => {
    symbolTable = new SymbolTableImpl();
  });

  describe("Scope Management", () => {
    test("should initialize with global scope", () => {
      expect(() => {
        symbolTable.lookupVariable("nonexistent");
      }).not.toThrow();
    });

    test("should enter and exit scopes", () => {
      // 进入新作用域
      symbolTable.enterScope();
      
      // 退出作用域
      expect(() => {
        symbolTable.exitScope();
      }).not.toThrow();
    });

    test("should not allow exiting global scope", () => {
      // 尝试退出全局作用域应该抛出错误
      expect(() => {
        symbolTable.exitScope();
      }).toThrow(SemanticError);
    });

    test("should manage nested scopes correctly", () => {
      // 在全局作用域中插入变量
      const globalVar: VariableSymbol = {
        UUID: genUUID(),
        name: "globalVar",
        type: i32Type(),
        mutable: true,
      };
      symbolTable.insertVariable("globalVar", globalVar);

      // 进入新作用域
      symbolTable.enterScope();

      // 在新作用域中插入同名变量（遮蔽）
      const localVar: VariableSymbol = {
        UUID: genUUID(),
        name: "globalVar",
        type: boolType(),
        mutable: true,
      };
      symbolTable.insertVariable("globalVar", localVar);

      // 查找应该返回局部变量（遮蔽）
      const foundVar = symbolTable.lookupVariable("globalVar");
      expect(foundVar).toBeDefined();
      expect(foundVar?.type.kind).toBe("primitiveType");
      expect((foundVar?.type as any).name).toBe("bool");

      // 退出作用域
      symbolTable.exitScope();

      // 查找应该返回全局变量
      const foundGlobalVar = symbolTable.lookupVariable("globalVar");
      expect(foundGlobalVar).toBeDefined();
      expect(foundGlobalVar?.type.kind).toBe("primitiveType");
      expect((foundGlobalVar?.type as any).name).toBe("i32");
    });
  });

  describe("Variable Symbol Management", () => {
    test("should insert and lookup variables", () => {
      const symbol: VariableSymbol = {
        UUID: genUUID(),
        name: "testVar",
        type: i32Type(),
        mutable: true,
      };

      // 插入变量
      expect(() => {
        symbolTable.insertVariable("testVar", symbol);
      }).not.toThrow();

      // 查找变量
      const foundSymbol = symbolTable.lookupVariable("testVar");
      expect(foundSymbol).toBeDefined();
      expect(foundSymbol?.name).toBe("testVar");
      expect(foundSymbol?.type.kind).toBe("primitiveType");
      expect((foundSymbol?.type as any).name).toBe("i32");
    });

    test("should prevent duplicate variable declarations in same scope", () => {
      const symbol1: VariableSymbol = {
        UUID: genUUID(),
        name: "testVar",
        type: i32Type(),
        mutable: true,
      };

      const symbol2: VariableSymbol = {
        UUID: genUUID(),
        name: "testVar",
        type: boolType(),
        mutable: true,
      };

      // 插入第一个变量
      symbolTable.insertVariable("testVar", symbol1);

      // 尝试插入同名变量应该抛出错误
      expect(() => {
        symbolTable.insertVariable("testVar", symbol2);
      }).toThrow(SemanticError);
    });

    test("should allow same name variables in different scopes", () => {
      const symbol1: VariableSymbol = {
        UUID: genUUID(),
        name: "testVar",
        type: i32Type(),
        mutable: true,
      };

      const symbol2: VariableSymbol = {
        UUID: genUUID(),
        name: "testVar",
        type: boolType(),
        mutable: true,
      };

      // 在当前作用域插入变量
      symbolTable.insertVariable("testVar", symbol1);

      // 进入新作用域
      symbolTable.enterScope();

      // 在新作用域中插入同名变量应该成功
      expect(() => {
        symbolTable.insertVariable("testVar", symbol2);
      }).not.toThrow();

      // 查找应该返回新作用域中的变量
      const foundSymbol = symbolTable.lookupVariable("testVar");
      expect(foundSymbol).toBeDefined();
      expect(foundSymbol?.type.kind).toBe("primitiveType");
      expect((foundSymbol?.type as any).name).toBe("bool");
    });

    test("should lookup variables in current scope only", () => {
      const symbol: VariableSymbol = {
        UUID: genUUID(),
        name: "testVar",
        type: i32Type(),
        mutable: true,
      };

      // 在当前作用域插入变量
      symbolTable.insertVariable("testVar", symbol);

      // 在当前作用域查找应该成功
      const foundInCurrent = symbolTable.lookupVariableInCurrentScope("testVar");
      expect(foundInCurrent).toBeDefined();

      // 进入新作用域
      symbolTable.enterScope();

      // 在新作用域查找应该失败
      const foundInNewScope = symbolTable.lookupVariableInCurrentScope("testVar");
      expect(foundInNewScope).toBeUndefined();
    });
  });

  describe("Type Symbol Management", () => {
    test("should insert and lookup types", () => {
      const typeSymbol: TypeSymbol = {
        UUID: genUUID(),
        name: "MyType",
        type: i32Type()
      };

      // 插入类型
      expect(() => {
        symbolTable.insertType("MyType", typeSymbol);
      }).not.toThrow();

      // 查找类型
      const foundType = symbolTable.lookupType("MyType");
      expect(foundType).toBeDefined();
      expect(foundType?.name).toBe("MyType");
    });

    test("should prevent duplicate type declarations in same scope", () => {
      const typeSymbol1: TypeSymbol = {
        UUID: genUUID(),
        name: "MyType",
        type: i32Type()
      };

      const typeSymbol2: TypeSymbol = {
        UUID: genUUID(),
        name: "MyType",
        type: boolType()
      };

      // 插入第一个类型
      symbolTable.insertType("MyType", typeSymbol1);

      // 尝试插入同名类型应该抛出错误
      expect(() => {
        symbolTable.insertType("MyType", typeSymbol2);
      }).toThrow(SemanticError);
    });

    test("should initialize with primitive types", () => {
      // 检查内置类型是否存在
      const i32Type = symbolTable.lookupType("i32");
      expect(i32Type).toBeDefined();
      expect(i32Type?.type.kind).toBe("primitiveType");

      const boolType = symbolTable.lookupType("bool");
      expect(boolType).toBeDefined();
      expect(boolType?.type.kind).toBe("primitiveType");

      const unitType = symbolTable.lookupType("()");
      expect(unitType).toBeDefined();
      expect(unitType?.type.kind).toBe("primitiveType");
    });
  });

  describe("Lookup Behavior", () => {
    test("should lookup variables in parent scopes", () => {
      const globalVar: VariableSymbol = {
        UUID: genUUID(),
        name: "globalVar",
        type: i32Type(),
        mutable: true,
      };

      // 在全局作用域插入变量
      symbolTable.insertVariable("globalVar", globalVar);

      // 进入新作用域
      symbolTable.enterScope();

      // 在新作用域中应该能找到全局变量
      const foundVar = symbolTable.lookupVariable("globalVar");
      expect(foundVar).toBeDefined();
      expect(foundVar?.name).toBe("globalVar");
    });

    test("should return undefined for nonexistent symbols", () => {
      const foundVar = symbolTable.lookupVariable("nonexistent");
      expect(foundVar).toBeUndefined();

      const foundType = symbolTable.lookupType("nonexistent");
      expect(foundType).toBeUndefined();
    });
  });
});