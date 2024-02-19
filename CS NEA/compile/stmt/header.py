from ..core import *

@ItemStatement.type("header")
class HeaderStatement(ItemStatement):
	def expand_main(self, ctx: Context):
		yield ctx.get_header(self.path or 1, self.name)
		ctx.add_indent()