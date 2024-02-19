from ..core import *

class SectionRefStatement(ItemStatement):
	def expand_items(self, ctx: Context, items: Iterable[ItemStatement]) -> Iterable[Block]:
		pass

	def expand_main(self, ctx: Context) -> Iterable[Block]:
		return self.expand_items(ctx, ctx.sections[self.name])

@ItemStatement.type("include")
class IncludeStatement(SectionRefStatement):
	def expand_items(self, ctx: Context, items: Iterable[ItemStatement]) -> Iterable[Block]:
		for item in items:
			yield from item.expand_main(ctx)