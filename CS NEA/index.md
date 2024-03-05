```
%% START

#.include @MAIN
.include @CLIENT_CODE

%% MAIN

.var renumber=1

.header @Analysis
	.fprefix ${Analysis/}
	.embed ${Introduction to problem}
	.embed ${Interview with Client}
	.embed ${Investigation}
	.embed ${Existing Solutions}


.header @Objectives
	.embed ${/Analysis/Objectives v2} @_ renumber=0


.header @{Documented Design}
	.fprefix ${Documented Design/}
	.embed ${Key algorithms}
	.embed ${Server Overview}
	
	.header $2 @{Data Structures}
		.embed ${Data structures/Canvas items} @{Canvas Items}
	
	.header $1
	.embed ${Server/Stored Data} @{Stored Data}
	.embed ${Server/Communication protocol} @{Communication Protocol}
	.embed ${Data structures/Message types} @{Message types}
	.embed ${Server/Web page structure} @{URL layout}
	.embed ${Client/Classes and structures} @{Client-side code}
	.embed ${Server/Structures and methods} @{Server-side code}

.header @{Technical Solution}
	.fprefix ${Technical Solution/}
	.embed ${Skills Used}
	
	.header $2 @{Server-side code}
	.include @SERVER_CODE
	
	.header $2 @{Client-side code}
	.include @CLIENT_CODE


.header @{System Testing}
	.fprefix ${Testing/}
	.embed ${Test table}

.header @Evaluation
	.fprefix ${Evaluation}


%% SERVER_CODE

.var cprefix={../project/server/src/} clang=rust

.code ${main.rs}
.code ${codegen.rs}
.code ${lib.rs}
.code ${utils.rs}
.code ${upload.rs}
.code ${client.rs}

.code ${canvas/canvas.rs}
	.code ${canvas/item.rs}
	.code ${canvas/active.rs}

.code ${message/message.rs}
	.code ${message/method.rs}
	.code ${message/iterate.rs}
	.code ${message/notify_c.rs}
	.code ${message/reject.rs}
	.code ${message/reject_helpers.rs}

.code ${board/board.rs}
	.code ${board/file.rs}
	.code ${board/active.rs}
		.code ${board/active_helpers.rs}
		.code ${board/method_impls.rs}
		.code ${board/iterate_impls.rs}
	.code ${board/manager.rs}

%% CLIENT_CODE

.var cprefix={../project/client/typescript/src/} clang=typescript

.code ${util/Utils.ts}



```