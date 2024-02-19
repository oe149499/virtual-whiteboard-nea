from typing import Union
import lrparsing as lr

from .core import ItemStatement, SectionStatement, Statement

class LineParser(lr.Grammar):
	class T(lr.TokenRegistry):
		word = lr.Token(re="[a-zA-Z_]+")
		item_name = lr.Token(re="\.[a-zA-Z_]+")
		number = lr.Token(re="-?[0-9]+(\.[0-9]+)?")
		string = lr.Token(re="\{[^{}]*\}")
	
	argument = T.word | T.number | T.string

	name_param = "@" + argument
	path_param = "$" + argument
	other_param = T.word + "=" + argument
	_param = name_param | path_param | other_param

	params = lr.Repeat(_param)
	
	section_stmt = "%%" + T.word
	item_stmt = T.item_name + params

	START = section_stmt | item_stmt

	@classmethod
	def tree_factory(C, tuple):
		rule = tuple[0]
		value = tuple[1] if len(tuple) > 1 else None
		T = C.T
		if rule is T.word:
			return value
		elif rule is T.number:
			if '.' in value:
				return float(value)
			else:
				return int(value)
		elif rule is T.string:
			return value[1:-1]
		elif rule is T.item_name:
			return value[1:]
		elif rule is C.argument:
			return value
		elif rule is C.name_param:
			return "@", tuple[2]
		elif rule is C.path_param:
			return "$", tuple[2]
		elif rule is C.other_param:
			return tuple[1], tuple[3]
		elif rule is C.params:
			out = {}
			for key, value in tuple[1:]:
				out[key] = value
			return out
		elif rule is C.section_stmt:
			return SectionStatement(tuple[2])
		elif rule is C.item_stmt:
			return ItemStatement.select(tuple[1], tuple[2])
		elif rule is C.START:
			return value
		elif type(rule) is str:
			return value

def parse(line: str) -> Union[Statement, None]:
	try:
		return lr.parse(LineParser, line, LineParser.tree_factory)
	except lr.TokenError:
		return None
	except lr.ParseError:
		return None