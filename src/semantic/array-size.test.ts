import { tokenize } from "../lexer/index";
import { execute } from "../parser/parsek/parsek";
import { crate } from "../parser/parser";
import { SemanticAnalyzer } from "../semantic/semantic";

// 测试数组大小检查功能
describe("数组大小检查功能测试", () => {
  test("数组大小与初始化大小不匹配，应该报错", () => {
    const code = `
fn main() {
    let numbers: [i32; 3] = [1, 2, 3, 4];
}
`;

    // 进行词法分析
    const tokens = tokenize(code);
    
    // 进行语法分析
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).not.toBeNull();
    
    const [crateNode] = parsed as [any, any];
    
    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);
    
    // 应该检测到错误
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("数组大小与初始化大小匹配，不应该报错", () => {
    const code = `
fn main() {
    let numbers: [i32; 3] = [1, 2, 3];
}
`;

    // 进行词法分析
    const tokens = tokenize(code);
    
    // 进行语法分析
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).not.toBeNull();
    
    const [crateNode] = parsed as [any, any];
    
    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);
    
    // 不应该检测到错误
    expect(result.errors.length).toBe(0);
  });

  test("重复数组大小与初始化大小不匹配，应该报错", () => {
    const code = `
fn main() {
    let numbers: [i32; 3] = [1; 4];
}
`;

    // 进行词法分析
    const tokens = tokenize(code);
    
    // 进行语法分析
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).not.toBeNull();
    
    const [crateNode] = parsed as [any, any];
    
    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);
    
    // 应该检测到错误
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("重复数组大小与初始化大小匹配，不应该报错", () => {
    const code = `
fn main() {
    let numbers: [i32; 3] = [1; 3];
}
`;

    // 进行词法分析
    const tokens = tokenize(code);
    
    // 进行语法分析
    const parsed = execute(crate, { token: tokens, start: 0 });
    
    expect(parsed).not.toBeNull();
    
    const [crateNode] = parsed as [any, any];
    
    // 进行语义分析
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(crateNode);
    
    // 不应该检测到错误
    expect(result.errors.length).toBe(0);
  });
});