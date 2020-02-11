@echo off

if not exist client\source\common.ts (
	echo Creating symlink to common.ts for client.
	mklink client\source\common.ts ..\..\common\common.ts
	if %errorLevel% neq 0 (
		goto adminError
	)
)

if not exist server\common.ts (
	echo Creating symlink to common.ts for server.
	mklink server\common.ts ..\common\common.ts
	if %errorLevel% neq 0 (
		goto adminError
	)
)

if not exist node_modules (
	echo Downloading node modules.
	npm install
)

echo Compiling client.
call node_modules\.bin\tsc -p client\tsconfig.json

echo Compiling server.
call node_modules\.bin\tsc -p server\tsconfig.json

exit /b

:adminError
echo Failed to create a symlink. Please run again with administrator privileges.
echo This is only necessary the first time you build the project.
exit /b 1