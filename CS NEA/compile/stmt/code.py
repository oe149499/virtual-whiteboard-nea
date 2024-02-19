from io import TextIOWrapper
from typing import Iterable
import re

from compile.core import Block, Context
from ..core import *

indent_re = re.compile('\S')

def get_indent(s: str):
	chars = indent_re.search(s).start()
	tabs = s.count('\t', 0, chars)
	return tabs + (chars - tabs) // 4, chars

def get_indent_prefix(count: int, _cache = {}) -> str:
	if count in _cache:
		return _cache[count]
	else:
		s = '\t' * count
		_cache[count] = s
		return s

def get_indent_line(count: int, _cache = {}) -> str:
	if count in _cache:
		return _cache[count]
	else:
		s = get_indent_prefix(count) + '\n'
		_cache[count] = s
		return s

class CodeFileBlock(Block):
	def __init__(self, path: str, language: str) -> None:
		self.path = path
		self.language = language

	def write_to(self, target: TextIOWrapper):
		target.write(f"```{self.language}\n")
		with open(self.path) as f:
			last_indent = 0
			while line := f.readline():
				if line.isspace():
					target.write(get_indent_line(last_indent))
				else:
					last_indent, offset = get_indent(line)
					target.write(get_indent_prefix(last_indent))
					target.write(line[offset:])
		target.write("\n```\n")

@ItemStatement.type("code")
class CodeEmbedStatement(ItemStatement):
	def expand_main(self, ctx: Context) -> Iterable[Block]:
		yield ctx.get_header(ctx.current_indent, self.name or self.path)
		code_prefix = ctx.get_var("cprefix") or ""
		code_path: str = code_prefix + self.path
		language = self.parameter("lang") or ctx.get_var("clang") or code_path.rsplit('.', 1)[-1]
		yield CodeFileBlock(code_path, language)
