from .meta import MetaStatement, FilePrefixStatement
from .embed import EmbedStatement
from .header import HeaderStatement
from .section import SectionRefStatement, IncludeStatement
from .code import CodeFileBlock, CodeEmbedStatement

from ..core import ItemStatement
@ItemStatement.type("null")
class NullStatement(ItemStatement):
	pass

_ = None