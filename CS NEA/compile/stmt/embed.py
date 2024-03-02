from typing import Iterable
from ..core import *

class FilteredFileBlock(Block):
	def __init__(self, path: str, header_prefix: str, add_nums: bool = False):
		self.path = path + ".md"
		self.header = header_prefix
		self.nums = add_nums
	
	def write_to(self, target):
		with open(self.path) as f:
			first = True
			header = header_generator()
			while line := f.readline():
				if first:
					first = False
					if line.startswith("---"):
						while not f.readline().startswith("---"):
							continue
						line = f.readline()
				if line.startswith('#') and ' ' in line:
					level = line.index(' ')
					target.write(line[:level])
					target.write(self.header)
					if self.nums:
						target.write(header(level))
					target.write(line[level:])
				else:
					target.write(line)
		target.write("\n")

@ItemStatement.type("embed")
class EmbedStatement(ItemStatement):
	def expand_main(self, ctx: Context) -> Iterable[Block]:
		if self.name != '_':
			yield ctx.get_header(ctx.current_indent, self.name or self.path)
			indent = ctx.current_indent
		else:
			indent = ctx.current_indent - 1
		
		indent_str = '#' * indent
		
		if "renumber" in self.other:
			renumber = bool(self.other["renumber"])
		elif (var := ctx.get_var("renumber")) is not None:
			renumber = bool(var)
		else:
			renumber = False
		
		prefix = f"{indent_str} {ctx.num_prefix}." if renumber else f"{indent_str} "

		path = ctx.get_path(self.path)

		yield FilteredFileBlock(path, prefix, renumber)
