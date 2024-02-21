from dataclasses import dataclass, field
from io import TextIOWrapper
from typing import Iterable, Type, Callable


class Block:
	def write_to(self, target: TextIOWrapper):
		pass

class StrBlock(Block):
	def __init__(self, data: str):
		self.data = data

	def write_to(self, target):
		target.write(self.data)

class Statement:
	pass

class SectionStatement(Statement):
	def __init__(self, name: str):
		self.name = name

class ItemStatement(Statement):
	TYPES = {}

	@staticmethod
	def select(item_type: str, params):
		if item_type in ItemStatement.TYPES:
			return ItemStatement.TYPES[item_type](params)
		else:
			print("unrecognized:", item_type, type(item_type))
	
	@staticmethod
	def type(name: str):
		def inner(cls: Type[ItemStatement]):
			ItemStatement.TYPES[name] = cls
		return inner
	
	def __init__(self, params):
		self.name = None
		self.path = None
		self.other = {}
		for key in params:
			value = params[key]
			if key == "@":
				self.name = value
			elif key == "$":
				self.path = value
			else:
				self.other[key] = value
		
		self.setup()
	
	def parameter(self, name: str):
		if name in self.other:
			return self.other[name]
		else:
			return None
	
	def setup(self):
		pass

	def expand_main(self, ctx: "Context") -> Iterable["Block"]:
		return ()

def header_generator():
	nums = []
	def _inner(level: int):
		if len(nums) >= level:
			while len(nums) > level:
				nums.pop(-1)
			nums[-1] += 1
		while len(nums) < level:
			nums.append(1)
		return '.'.join(str(i) for i in nums)
	_inner.nums = nums
	return _inner

@dataclass
class Context:
	sections: dict[str, list["ItemStatement"]]

	current_indent: int = 1
	header: Callable[[int], str] = field(default_factory=header_generator)
	num_prefix: str = ""

	file_prefix: str = "./"
	variables: dict = field(default_factory=dict)

	def get_header(self, indent: int, text: str):
		num_fmt = self.header(indent)
		self.num_prefix = num_fmt
		self.current_indent = indent
		return StrBlock(f"{'#'*indent} {num_fmt} {text}\n")
	
	def add_indent(self):
		self.current_indent += 1
	
	def get_path(self, path: str):
		if path.startswith('/'):
			return '.' + path
		else:
			return self.file_prefix + path
	
	def get_var(self, name: str):
		if name in self.variables:
			return self.variables[name]
		else:
			return None