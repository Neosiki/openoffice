# Agent mode

The agent takes one folder you choose as a project and runs Claude Code or Codex from this PC in that folder. The AI reads the material in the folder itself, creates new files, uses skills and scripts, and edits the documents open in GenOffice. Use it for work that draws on a lot of material.

## Before you start

- A Claude subscription or a ChatGPT subscription connected under **Settings ▸ AI**. The "Subscription connection" topic explains how.
- A folder with your material in it. A whole drive, your whole home folder, and folders of sign-in or app data cannot be chosen.

## Starting a session

1. In the left sidebar of Home, click **Agent**. The agent window opens on its own.
2. Click **Choose a folder…** to pick the project folder. Folders you used recently are listed under **Recent folders**.
3. Under **Program**, choose Claude Code or Codex. A program that is not connected cannot be chosen.
4. Under **When to ask you**, choose how the agent asks for permission (table below).
5. The first time, read **Before you start** and click **I understand**.
6. Click **Start**, write what you want done, and click **Send**.

One window is one session. Closing the window or clicking **Stop** ends the session, and the program GenOffice started for it ends too. A session also ends after 30 minutes with nothing sent.

## How the agent asks

| Choice                                 | Goes ahead                                                              | Asks first                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Ask before every command** (default) | Reading and writing files in the project folder, editing open documents | Running a command or script, reading outside the project folder         |
| **Ask before writing and commands**    | Reading files in the project folder, editing open documents             | Writing a file, running a command or script, reading outside the folder |
| **Trust this project**                 | Almost everything                                                       | Reading outside the project folder                                      |

When the agent asks, the window shows what it wants to do (the whole command, the file path). Click **Allow** or **Decline**.

Whatever you choose, the agent does not:

- Overwrite the file of a document open in a GenOffice tab. Open documents are edited through the app, so the change shows in the editor at once and the editor's undo takes it back.
- Write outside the project folder.
- Touch the sign-in data of Claude or Codex, or GenOffice's data folder.

## Claude Code and Codex

- **Codex** runs commands in its own isolated space, including the ones you allow. It can write only in the project folder, the internet is blocked, and it cannot read your personal files outside the project. When a session starts, GenOffice first checks that this isolation works on this PC, and does not start if it does not.
- **Claude Code** cannot isolate commands on Windows. A command you allow can reach the whole PC and the internet. That is why, under **Trust this project**, Claude Code's own reviewer checks each action instead of you.

A document someone sent you can carry hidden instructions that tell the AI to do something else. In a folder of material you do not know, use one of the choices that ask.

## Project notes and skills

- If the folder has a `CLAUDE.md` or `AGENTS.md`, its contents are given to the agent as instructions. Write down what should hold every time: tone, terms, the format of the documents to make.
- Claude Code gets a copy of the skills in these places: `.claude/skills` in the project folder, `.ieumoffice/skills` and `.claude/skills` in your home folder, and the skills of installed Claude plugins. The number of skills available appears under the line that says the session started.
- Codex reads its own skills folder by itself.
- Programs a skill's scripts use (Python and so on) must be installed on this PC.

## New files and open documents

- New files the agent makes are saved in the project folder. Click **Open** on that line of the progress log to open the file in a GenOffice tab.
- To have an open document edited, open it in GenOffice first and name it in your request.
- A document you open during a session can be edited from your next message on.

## Privacy and usage

- What you hid from the AI stays hidden only when the app reads a document open in GenOffice for the agent. Files the agent reads from the folder itself are sent as they are.
- The agent works in many steps, so it uses more of your subscription limit than the AI panel. When the limit runs out, the request fails; the agent never moves to another AI or to a connection that is billed.

## If something goes wrong

| What the window says                      | What to do                                          |
| ----------------------------------------- | --------------------------------------------------- |
| **Not connected**                         | Sign in to that program under **Settings ▸ AI**.    |
| **This folder cannot be used**            | Choose a folder that holds only your work material. |
| **Codex cannot open the sandbox**         | Update Windows, or choose Claude Code.              |
| **Your subscription limit is used up**    | Send again after the limit resets.                  |
| **The program is too old for agent mode** | Update that program, then click **New session**.    |
