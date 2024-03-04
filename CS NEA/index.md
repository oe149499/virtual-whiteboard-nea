```
%% START

.include @MAIN

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
.fprefix ${Documented Design/Data structures/}
.embed ${Canvas items}

.header $1
.embed ${/Documented Design/Client/Classes and structures} @{Client-side code}
.embed ${/Documented Design/Server/Structures and methods} @{Server-side code}

.header @{Technical Solution}
.fprefix ${Technical Solution/}
.embed ${Skills Used}

.header $2 @{Server-side code}
.include @SERVER_CODE

.header $2 @{Client-side code}
.include @CLIENT_CODE


.header @{System Testing}
.fprefix ${Testing/}
.embed ${Test Plan}

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


%% CLIENT_CODE

.var cprefix={../project/client/typescript/src/} clang=typescript
.code ${Board.ts}

```