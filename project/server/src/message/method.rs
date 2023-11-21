use serde::{Serialize, Deserialize};
use ts_rs::TS;

use super::{ClientInfo, ClientID, SessionID};

pub trait Method {
	type Response : TS + Serialize;
}

#[derive(TS, Serialize, Deserialize)]
pub struct Call<T : Method> {
	id: u32,
	#[serde(flatten)]
	pub params: T,
}

impl <T : Method> Call<T> {
	pub fn create_response(&self, value: T::Response) -> Response<T> {
		Response {
			id: self.id,
			value
		}
	}
}

#[derive(TS, Serialize, Deserialize)]
pub struct Response<T : Method> {
	id: u32,
	pub value: T::Response,
}


macro_rules! declare_method {
	{fn $method_name:ident($($param_name:ident: $param_type:ty),*) -> $return_type:ty;} => {
		#[derive(TS, Serialize, Deserialize)]
		pub struct $method_name {
			$(
				pub $param_name: $param_type,
			)*
		}

		impl Method for $method_name {
			type Response = $return_type;
		}
	}
}

declare_method!{
	fn Connect(info: ClientInfo) -> super::Result<ClientID, SessionID>;
}