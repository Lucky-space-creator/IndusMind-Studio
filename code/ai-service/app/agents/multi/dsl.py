from __future__ import annotations

import json
import re

from app.core.logging import get_logger

log = get_logger(__name__)

_TOKEN_RE = re.compile(
    r"\s*(?:(>=|<=|==|!=|&&|\|\||[()><.])"
    r"|([A-Za-z_][A-Za-z0-9_]*)"
    r"|('[^']*'|\"[^\"]*\")"
    r"|(-?\d+(?:\.\d+)?))"
)

_OPERATORS = {"==", "!=", ">", "<", ">=", "<="}


class DslError(Exception):
    pass


class _Parser:
    def __init__(self, tokens: list[tuple[str, object]]):
        self.tokens = tokens
        self.pos = 0

    def peek(self):
        return self.tokens[self.pos] if self.pos < len(self.tokens) else (None, None)

    def next(self):
        token = self.peek()
        self.pos += 1
        return token

    def expect(self, value):
        token = self.next()
        if token[0] != "op" or token[1] != value:
            raise DslError(f"期望 {value}，实际 {token}")
        return token

    def parse(self):
        node = self.parse_or()
        if self.peek()[0] is not None:
            raise DslError(f"表达式解析未完成，剩余 {self.tokens[self.pos:]}")
        return node

    def parse_or(self):
        node = self.parse_and()
        while self.peek() == ("op", "||"):
            self.next()
            node = ("or", node, self.parse_and())
        return node

    def parse_and(self):
        node = self.parse_term()
        while self.peek() == ("op", "&&"):
            self.next()
            node = ("and", node, self.parse_term())
        return node

    def parse_term(self):
        if self.peek() == ("op", "("):
            self.next()
            node = self.parse_or()
            self.expect(")")
            return node
        agent = self.parse_name()
        self.expect(".")
        field = self.parse_name()
        op_token = self.next()
        if op_token[0] != "op" or op_token[1] not in _OPERATORS:
            raise DslError(f"期望比较运算符，实际 {op_token}")
        value = self.parse_value()
        return ("term", agent, field, op_token[1], value)

    def parse_name(self):
        token = self.next()
        if token[0] != "name":
            raise DslError(f"期望字段名，实际 {token}")
        return token[1]

    def parse_value(self):
        token = self.next()
        kind, value = token
        if kind == "string":
            return value
        if kind == "number":
            return float(value) if "." in value else int(value)
        if kind == "name":
            lowered = value.lower()
            if lowered == "true":
                return True
            if lowered == "false":
                return False
            return value
        raise DslError(f"非法取值 {token}")


def _tokenize(expr: str) -> list[tuple[str, object]]:
    tokens: list[tuple[str, object]] = []
    index = 0
    text = expr.strip()
    while index < len(text):
        match = _TOKEN_RE.match(text, index)
        if not match or match.end() == index:
            raise DslError(f"无法识别的字符位置 {index}: {text[index:index + 10]}")
        op, name, string, number = match.groups()
        if op:
            tokens.append(("op", op))
        elif name:
            tokens.append(("name", name))
        elif string:
            tokens.append(("string", string[1:-1]))
        elif number:
            tokens.append(("number", number))
        index = match.end()
    return tokens


def _unwrap_json_expr(expr: str) -> str:
    text = (expr or "").strip()
    for _ in range(2):
        if not (text.startswith("{") and text.endswith("}")):
            break
        try:
            data = json.loads(text)
        except ValueError:
            break
        if isinstance(data, dict) and isinstance(data.get("expr"), str):
            text = data["expr"].strip()
        else:
            break
    return text


def compile_condition(expr: str):
    if expr is None or not expr.strip():
        return None
    unwrapped = _unwrap_json_expr(expr)
    if not unwrapped:
        return None
    return _Parser(_tokenize(unwrapped)).parse()


def _compare(actual, op: str, expected) -> bool:
    if op in ("==", "!="):
        if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
            equal = abs(float(actual) - float(expected)) < 1e-9
        else:
            equal = str(actual).strip().lower() == str(expected).strip().lower()
        return equal if op == "==" else not equal
    try:
        left = float(actual)
        right = float(expected)
    except (TypeError, ValueError):
        raise DslError(f"无法比较 {actual!r} {op} {expected!r}")
    if op == ">":
        return left > right
    if op == "<":
        return left < right
    if op == ">=":
        return left >= right
    if op == "<=":
        return left <= right
    raise DslError(f"不支持的运算符 {op}")


def _eval(node, context: dict) -> bool:
    kind = node[0]
    if kind == "or":
        return _eval(node[1], context) or _eval(node[2], context)
    if kind == "and":
        return _eval(node[1], context) and _eval(node[2], context)
    _, agent_code, field, op, expected = node
    agent_output = context.get(agent_code)
    if not isinstance(agent_output, dict) or field not in agent_output:
        raise DslError(f"未定义字段 {agent_code}.{field}")
    return _compare(agent_output[field], op, expected)


def evaluate(expr: str, context: dict) -> bool | None:
    try:
        ast = compile_condition(expr)
    except DslError as exc:
        log.warning("触发条件解析失败，节点跳过：%s", exc)
        return None
    if ast is None:
        return True
    try:
        return _eval(ast, context)
    except DslError as exc:
        log.warning("触发条件求值失败，节点跳过：%s", exc)
        return None