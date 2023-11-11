use std::{marker::PhantomData, fs::File, io::Write};
use itertools::Itertools;
use ts_rs::{TS, ExportError};

#[derive(TS)]
struct TestMessage {

}

#[derive(TS)]
struct TestType {

}

#[derive(TS)]
enum EnumTest {
	Message(TestMessage),
	Type(TestType),
}

trait Exporter where Self : 'static {
	fn export_to_string(&self) -> Result<String, ExportError>;
	fn decl(&self) -> String;
}
struct _Exporter<T:TS>(PhantomData<T>);

impl<T:TS> _Exporter<T> {
	fn new() -> Box<Self> {
		Box::new(Self(PhantomData))
	}
}

impl<T: TS + 'static> Exporter for _Exporter<T> {
	fn export_to_string(&self) -> Result<String, ExportError> where Self : 'static {
		T::export_to_string()
	}

	fn decl(&self) -> String {
		T::decl()
	}
}

fn main() {
	let to_export: Vec<Box<dyn Exporter>> = vec![
		_Exporter::<TestMessage>::new(),
		_Exporter::<TestType>::new(),
		_Exporter::<EnumTest>::new(),
		];
	let export_strings: String = to_export.iter().map(
		|e| e.decl()
	).join("\n");
	let mut args = std::env::args();
	while args.next().expect("Missing 'to' argument (usage '<exec> to <file location>')") != "to" {}
	let mut file = File::create(args.next().unwrap()).unwrap();
	file.write(export_strings.as_bytes()).expect("File write failed");
	
}