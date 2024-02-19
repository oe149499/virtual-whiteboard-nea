from typing import Iterable
from ..core import *

class FilteredFileBlock(Block):
	def __init__(self, path: str, header_prefix: str):
		self.path = path + ".md"
		self.header = header_prefix
	
	def write_to(self, target):
		with open(self.path) as f:
			first = True
			while line := f.readline():
				if first:
					first = False
					if line.startswith("---"):
						while not f.readline().startswith("---"):
							continue
						line = f.readline()
				if line.startswith('#'):
					level = line.index(' ')
					target.write(line[:level])
					target.write(self.header)
					target.write(line[level:])
				else:
					target.write(line)
		target.write("\n")

@ItemStatement.type("embed")
class EmbedStatement(ItemStatement):
	def expand_main(self, ctx: Context) -> Iterable["Block"]:
		if self.name == '_':
			yield FilteredFileBlock(ctx.get_path(self.path), f"{'#' * (ctx.current_indent - 1)} ")
		else:
			yield ctx.get_header(ctx.current_indent, self.name or self.path)
			yield FilteredFileBlock(ctx.get_path(self.path), f"{'#' * ctx.current_indent} ")