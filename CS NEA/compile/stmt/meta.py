from compile.core import Context
from ..core import *

class MetaStatement(ItemStatement):
	def apply(self, ctx: Context):
		pass
	def expand_main(self, ctx: Context) -> Iterable[Block]:
		self.apply(ctx)
		return ()

@ItemStatement.type("fprefix")
class FilePrefixStatement(MetaStatement):
	def apply(self, ctx: Context):
		ctx.file_prefix = self.path

@ItemStatement.type("var")
class VarStatement(MetaStatement):
	def apply(self, ctx: Context):
		for key in self.other:
			ctx.variables[key] = self.other[key]