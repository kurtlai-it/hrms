ASM Tech HRMS - New UI
======================

What this package is
--------------------
The HR and payroll system with the new user interface for older HR staff: larger text and buttons, every page within two presses of Home, English / Bahasa Melayu / Chinese, and pages built around daily HR work. It also includes the fixes for server write permissions, payroll calculations (PCB/EPF) and self-approval.

Made from git branch release/new-ui, commit 88e530fd812e8a53da087c3dad366537d6657af3
(asmly14/hrms repository).

The packages
------------
HRMS-new-ui-source.zip     The source code. It does not contain node_modules,
                             build output or files that are only used by AI
                             coding tools or for design work.
HRMS-new-ui-web-build.zip  The web app already built in demo mode
                             (VITE_DATA_MODE=local). Put the files on any
                             static web server (see "Using the web build").

What you need
-------------
Node.js 24 (Node 22.22 or newer also works). npm comes with Node.

Run it in demo mode (no database)
---------------------------------
Demo mode keeps all data in the web browser (localStorage). Nothing is sent to
a server.

1. Unzip HRMS-new-ui-source.zip and open a terminal in the unzipped folder.
2. npm ci
3. npm run dev
4. Open http://localhost:3000 in a web browser.

Demo logins (company ASM Tech):
  Admin     admin / admin123
  HR        hr / hr123
  Manager   ahmad.faizal / manager123
  Employee  siti5 / password123
            (this account is created the first time someone signs in as admin)

Build it
--------
npm run build
The finished web app is written to the dist folder. To build for demo mode,
leave VITE_DATA_MODE unset or set it to "local".

To try the build on your own computer: npm run preview (http://localhost:4173).

Using the web build
-------------------
Unzip HRMS-new-ui-web-build.zip onto a static web server. The app uses
normal page addresses (such as /leave), so the server must send index.html
for any address that is not a file. The build works from any folder on the
server.

Run with the server and PostgreSQL
----------------------------------
The server folder holds the back end (Node, Fastify, PostgreSQL). Its set-up
steps are in server/README.md: start PostgreSQL (docker compose is the easy
way), load the schema, run "npm run seed", then "npm run dev" (port 4010).
To point the web app at it, build or run the web app with
VITE_DATA_MODE=api and VITE_API_URL set to the server address.
