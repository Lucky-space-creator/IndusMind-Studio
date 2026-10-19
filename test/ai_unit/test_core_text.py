# -*- coding: utf-8 -*-
"""app/core/text.py 纯函数单元测试。"""
import sys
import pathlib
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "code" / "ai-service"))

from app.core.text import contains_cjk, tokenize, to_tsvector_text, truncate  # noqa: E402


class TestTokenize(unittest.TestCase):
    """tokenize 切分、停用词、小写化。"""

    def test_tokenize_mixed_cn_en(self):
        """中英混合切分：英文小写化、中文按单字切。"""
        self.assertEqual(tokenize("液压泵 The Pressure 高"), ["液", "压", "泵", "pressure", "高"])

    def test_tokenize_empty_string(self):
        """空串返回空列表。"""
        self.assertEqual(tokenize(""), [])

    def test_tokenize_none(self):
        """None 输入返回空列表。"""
        self.assertEqual(tokenize(None), [])

    def test_tokenize_stopwords_filtered(self):
        """中英文停用词均被过滤。"""
        self.assertEqual(tokenize("的 了 和 the a of is"), [])

    def test_tokenize_english_lowercased(self):
        """英文统一小写化。"""
        self.assertEqual(tokenize("PUMP Status WARNING"), ["pump", "status", "warning"])

    def test_tokenize_digits_and_underscore(self):
        """字母数字下划线连成一个 token。"""
        self.assertEqual(tokenize("V2_1 pump123"), ["v2_1", "pump123"])

    def test_tokenize_punctuation_dropped(self):
        """标点与空白不进入 token。"""
        self.assertEqual(tokenize("泵,压力!温度。"), ["泵", "压", "力", "温", "度"])


class TestToTsvectorText(unittest.TestCase):
    """to_tsvector_text 拼接。"""

    def test_to_tsvector_text_joins_tokens(self):
        """分词结果以空格拼接。"""
        self.assertEqual(to_tsvector_text("The 泵 压力"), "泵 压 力")

    def test_to_tsvector_text_empty(self):
        """空输入返回空串。"""
        self.assertEqual(to_tsvector_text(""), "")


class TestContainsCjk(unittest.TestCase):
    """contains_cjk 判断。"""

    def test_contains_cjk_pure_chinese_true(self):
        """纯中文返回 True。"""
        self.assertTrue(contains_cjk("液压泵"))

    def test_contains_cjk_mixed_true(self):
        """中英混合只要含一个汉字即 True。"""
        self.assertTrue(contains_cjk("pump 泵"))

    def test_contains_cjk_pure_english_false(self):
        """纯英文返回 False。"""
        self.assertFalse(contains_cjk("hydraulic pump"))

    def test_contains_cjk_empty_false(self):
        """空串返回 False。"""
        self.assertFalse(contains_cjk(""))

    def test_contains_cjk_none_false(self):
        """None 输入返回 False 而不抛错。"""
        self.assertFalse(contains_cjk(None))


class TestTruncate(unittest.TestCase):
    """truncate 截断。"""

    def test_truncate_none_returns_empty(self):
        """None 输入返回空串。"""
        self.assertEqual(truncate(None, 5), "")

    def test_truncate_exactly_limit_kept(self):
        """长度恰好等于 limit 时原样返回。"""
        self.assertEqual(truncate("abcde", 5), "abcde")

    def test_truncate_shorter_kept(self):
        """短于 limit 时原样返回。"""
        self.assertEqual(truncate("abc", 5), "abc")

    def test_truncate_longer_cut(self):
        """超长时截断到 limit。"""
        self.assertEqual(truncate("abcdefg", 3), "abc")

    def test_truncate_zero_limit(self):
        """limit=0 且非空文本时截为空串。"""
        self.assertEqual(truncate("abc", 0), "")

    def test_truncate_empty_text(self):
        """空文本原样返回。"""
        self.assertEqual(truncate("", 3), "")


if __name__ == "__main__":
    unittest.main()