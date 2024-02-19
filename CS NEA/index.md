```
%% START

.include @MAIN

%% MAIN

.header @Analysis
.fprefix ${Analysis/}
.embed ${Introduction to problem}
.embed ${Interview with Client}
.embed ${Investigation}
.embed ${Existing Solutions}

.header @Objectives
.embed ${/Analysis/Objectives v2} @_

.header @{Documented Design}
.fprefix ${Documented Design/}

.header $2 @{Data Structures}
.fprefix ${Documented Design/Data structures/}
.embed ${Transfer} @{Client-server communication}

.header @{Technical Solution}

.header $2 @{Server-side code}
.include @SERVER_CODE

.header $2 @{Client-side code}
.include @CLIENT_CODE

.header @{System Testing}
.fprefix ${Testing}

.header @Evaluation
.fprefix ${Evaluation}

%% SERVER_CODE

.var cprefix={../project/server/src/} clang=rust

.code ${main.rs}

%% CLIENT_CODE

.var cprefix={../project/client/typescript/src/} clang=typescript
.code ${Board.ts}

```