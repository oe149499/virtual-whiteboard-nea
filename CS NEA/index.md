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
.embed ${Client Overview}
.embed ${Server Overview}

.header $2 @{Data Structures}
.fprefix ${Documented Design/Data structures/}
.embed ${Canvas items}

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