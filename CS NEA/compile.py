from compile.core import Context, ItemStatement, SectionStatement
from compile.parse import parse


def get_statements(path: str):
	with open(path) as f:
		while line := f.readline():
			stmt = parse(line)
			if stmt is not None:
				yield stmt

sections = {}
current_section: list[ItemStatement] | None = None

for item in get_statements("./index.md"):
	if isinstance(item, SectionStatement):
		current_section = []
		sections[item.name] = current_section
	elif isinstance(item, ItemStatement):
		current_section.append(item)

context = Context(sections)

with open("./combined.md", "w") as f:
	for item in context.sections["START"]:
		for block in item.expand_main(context):
			block.write_to(f)