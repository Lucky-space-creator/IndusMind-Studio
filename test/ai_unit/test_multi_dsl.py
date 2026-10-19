# -*- coding: utf-8 -*-
"""app/agents/multi/dsl.py DSL 条件表达式单元测试。"""
import sys
import pathlib
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.agents.multi.dsl import (  # noqa: E402
    DslError,
    _compare,
    compile_condition,
    evaluate,
)


class TestCompileCondition(unittest.TestCase):
    """compile_condition 语法解析。"""

    def test_compile_simple_comparison(self):
        """简单比较编译为 term 节点。"""
        ast = compile_condition("a.b > 1")
        self.assertEqual(ast, ("term", "a", "b", ">", 1))

    def test_compile_and_expression(self):
        """&& 组合编译为 and 节点。"""
        ast = compile_condition("a.b > 1 && c.d == 'x'")
        self.assertEqual(
            ast,
            ("and", ("term", "a", "b", ">", 1), ("term", "c", "d", "==", "x")),
        )

    def test_compile_and_priority_over_or(self):
        """&& 优先级高于 ||：a || b && c 解析为 or(a, and(b, c))。"""
        ast = compile_condition("a.b > 1 || c.d == 2 && e.f < 3")
        self.assertEqual(ast[0], "or")
        self.assertEqual(ast[1], ("term", "a", "b", ">", 1))
        self.assertEqual(ast[2], ("and", ("term", "c", "d", "==", 2), ("term", "e", "f", "<", 3)))

    def test_compile_parentheses_grouping(self):
        """括号改变结合顺序。"""
        ast = compile_condition("(a.b > 1 || c.d == 2) && e.f < 3")
        self.assertEqual(ast[0], "and")
        self.assertEqual(ast[1], ("or", ("term", "a", "b", ">", 1), ("term", "c", "d", "==", 2)))
        self.assertEqual(ast[2], ("term", "e", "f", "<", 3))

    def test_compile_empty_string_returns_none(self):
        """空串 → None。"""
        self.assertIsNone(compile_condition(""))

    def test_compile_blank_string_returns_none(self):
        """纯空白串 → None。"""
        self.assertIsNone(compile_condition("   "))

    def test_compile_none_returns_none(self):
        """None → None。"""
        self.assertIsNone(compile_condition(None))

    def test_compile_illegal_char_raises(self):
        """非法字符抛 DslError。"""
        with self.assertRaises(DslError):
            compile_condition("a.b > 1 @ c.d == 2")

    def test_compile_missing_operator_raises(self):
        """a.b 缺运算符抛 DslError。"""
        with self.assertRaises(DslError):
            compile_condition("a.b")

    def test_compile_negative_and_decimal_number(self):
        """负数与小数取值。"""
        self.assertEqual(compile_condition("a.b > -1.5"), ("term", "a", "b", ">", -1.5))
        self.assertEqual(compile_condition("a.b == 2"), ("term", "a", "b", "==", 2))

    def test_compile_double_quoted_string(self):
        """双引号字符串取值。"""
        self.assertEqual(
            compile_condition('a.b == "x"'),
            ("term", "a", "b", "==", "x"),
        )

    def test_compile_true_false_literals(self):
        """true/false 字面量解析为布尔。"""
        self.assertEqual(compile_condition("a.b == true"), ("term", "a", "b", "==", True))
        self.assertEqual(compile_condition("a.b == false"), ("term", "a", "b", "==", False))

    def test_compile_operators_supported(self):
        """六种比较运算符均可编译。"""
        for op in ("==", "!=", ">", "<", ">=", "<="):
            ast = compile_condition(f"a.b {op} 1")
            self.assertEqual(ast, ("term", "a", "b", op, 1))

    def test_compile_trailing_tokens_raises(self):
        """表达式尾部多余 token 抛 DslError。"""
        with self.assertRaises(DslError):
            compile_condition("a.b > 1 c.d")


class TestJsonShellUnwrap(unittest.TestCase):
    """JSON 壳表达式解包（V2 种子 trigger_condition 为 {"expr": "..."} 格式）。"""

    def test_compile_single_json_shell(self):
        """单层 JSON 壳 {"expr": "a.b == 1"} 正常编译。"""
        ast = compile_condition('{"expr": "a.b == 1"}')
        self.assertEqual(ast, ("term", "a", "b", "==", 1))

    def test_compile_double_json_shell(self):
        """两层嵌套 JSON 壳仍可解包。"""
        ast = compile_condition('{"expr": "{\\"expr\\": \\"a.b == 1\\"}"}')
        self.assertEqual(ast, ("term", "a", "b", "==", 1))

    def test_compile_json_shell_with_spaces(self):
        """JSON 壳带前后空白与转义引号。"""
        ast = compile_condition('  {"expr": "monitor.deviceStatus != \'normal\'"}  ')
        self.assertEqual(ast, ("term", "monitor", "deviceStatus", "!=", "normal"))

    def test_compile_json_without_expr_key_raises(self):
        """JSON 但无 expr 键 → 按原文 tokenize → DslError。"""
        with self.assertRaises(DslError):
            compile_condition('{"condition": "a.b == 1"}')

    def test_compile_broken_json_stays_raw_raises(self):
        """非法 JSON（如 {expr}）保持原串 → DslError（语义与旧版一致）。"""
        with self.assertRaises(DslError):
            compile_condition("{expr}")

    def test_compile_expr_not_string_falls_back(self):
        """expr 非字符串（数字）→ 不解包 → DslError。"""
        with self.assertRaises(DslError):
            compile_condition('{"expr": 123}')

    def test_evaluate_json_shell_condition(self):
        """带 JSON 壳的触发条件可正常求值。"""
        ctx = {"monitor": {"deviceStatus": "abnormal"}}
        self.assertTrue(evaluate('{"expr": "monitor.deviceStatus == \'abnormal\'"}', ctx))
        self.assertFalse(evaluate('{"expr": "monitor.deviceStatus == \'normal\'"}', ctx))


class TestEvaluate(unittest.TestCase):
    """evaluate 求值。"""

    def test_evaluate_true_condition(self):
        """命中条件返回 True。"""
        self.assertTrue(evaluate("m.severity == 'high'", {"m": {"severity": "high"}}))

    def test_evaluate_false_condition(self):
        """不命中返回 False。"""
        self.assertFalse(evaluate("m.severity == 'high'", {"m": {"severity": "low"}}))

    def test_evaluate_combined_and(self):
        """&& 组合需两侧同时成立。"""
        ctx = {"m": {"severity": "high"}, "s": {"riskLevel": "medium"}}
        self.assertTrue(evaluate("m.severity == 'high' && s.riskLevel == 'medium'", ctx))
        self.assertFalse(evaluate("m.severity == 'high' && s.riskLevel == 'high'", ctx))

    def test_evaluate_combined_or(self):
        """|| 组合一侧成立即可。"""
        ctx = {"m": {"severity": "low"}, "s": {"riskLevel": "high"}}
        self.assertTrue(evaluate("m.severity == 'high' || s.riskLevel == 'high'", ctx))
        self.assertFalse(evaluate("m.severity == 'high' || s.riskLevel == 'low'", ctx))

    def test_evaluate_missing_agent_returns_none(self):
        """context 缺整个 agent → None（节点跳过）。"""
        self.assertIsNone(evaluate("m.severity == 'high'", {}))

    def test_evaluate_missing_field_returns_none(self):
        """context 缺字段 → None。"""
        self.assertIsNone(evaluate("m.severity == 'high'", {"m": {}}))

    def test_evaluate_parse_failure_returns_none(self):
        """表达式解析失败 → None 而非异常。"""
        self.assertIsNone(evaluate("a.b", {"a": {"b": 1}}))

    def test_evaluate_empty_expression_true(self):
        """空表达式恒 True（无触发条件即执行）。"""
        self.assertTrue(evaluate("", {"m": {}}))

    def test_evaluate_none_expression_true(self):
        """None 表达式恒 True。"""
        self.assertTrue(evaluate(None, {}))

    def test_evaluate_bool_literal(self):
        """布尔字面量比较。"""
        self.assertTrue(evaluate("m.flag == true", {"m": {"flag": True}}))
        self.assertFalse(evaluate("m.flag == true", {"m": {"flag": False}}))

    def test_evaluate_numeric_comparison(self):
        """数值大小比较。"""
        ctx = {"m": {"value": 10}}
        self.assertTrue(evaluate("m.value >= 10", ctx))
        self.assertFalse(evaluate("m.value < 10", ctx))


class TestCompare(unittest.TestCase):
    """_compare 比较语义。"""

    def test_compare_float_tolerance(self):
        """数值等值比较带 1e-9 容差：0.1+0.2 == 0.3 为 True。"""
        self.assertTrue(_compare(0.1 + 0.2, "==", 0.3))

    def test_compare_string_case_and_space_insensitive(self):
        """字符串等值比较 strip + lower 不敏感。"""
        self.assertTrue(_compare(" High ", "==", "high"))
        self.assertFalse(_compare("High", "==", "low"))

    def test_compare_string_not_equal(self):
        """字符串 != 判断。"""
        self.assertTrue(_compare("A", "!=", "b"))

    def test_compare_lt_non_numeric_raises(self):
        """< 遇非数值抛 DslError。"""
        with self.assertRaises(DslError):
            _compare("abc", "<", 5)

    def test_compare_gt_non_numeric_raises(self):
        """> 遇不可转数值的取值抛 DslError。"""
        with self.assertRaises(DslError):
            _compare(5, ">", "xyz")

    def test_compare_numeric_ordering(self):
        """数值大小比较语义正确。"""
        self.assertTrue(_compare(3, ">", 2))
        self.assertTrue(_compare(2, "<", 3))
        self.assertTrue(_compare(3, ">=", 3))
        self.assertTrue(_compare(3, "<=", 3))
        self.assertFalse(_compare(3, "<", 3))

    def test_compare_int_float_mixed(self):
        """int 与 float 混合比较走数值分支。"""
        self.assertTrue(_compare(1, "==", 1.0))

    def test_compare_bool_as_number(self):
        """bool 字面量按数值比较（True==1）。"""
        self.assertTrue(_compare(True, "==", True))
        self.assertTrue(_compare(True, "!=", False))


if __name__ == "__main__":
    unittest.main()