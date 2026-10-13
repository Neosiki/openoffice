# IeumOffice Privacy

Last updated: October 13, 2026

IeumOffice opens, edits and saves documents on your own PC. The project runs
no server of its own: nothing is sent to IeumOffice or to its maintainers, and
the app has no usage analytics or telemetry.

Data leaves your PC only in the situations listed below, and each time it goes
directly from your PC to the service named there. This page describes what the
app does; what each of those services does with what it receives is governed
by that service's own terms and by your account settings there.

## What leaves your PC

| When                                                                                   | What is sent                                                                                                   | Where it goes                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You use AI with a connected Claude or Codex subscription (the default)                 | What you typed, the document content the request works on, the files and images you attached, the conversation | **Anthropic** (Claude) or **OpenAI** (Codex), under your own account. The app hands the request to the Claude Code or Codex program installed on your PC, and that program sends it with the login you made there |
| You use AI with an API-key provider you set up under Settings → AI → Advanced          | The same content                                                                                               | The company, or your own server, whose key or address you entered                                                                                                                                                 |
| The AI, or the `ieumoffice search` command, searches the web or looks for images       | The search query                                                                                               | By default **Parallel**'s free search and **DuckDuckGo**, no key needed. If you chose a key-based search provider under Advanced (Serper, Serply, Tavily, Parallel, Exa or Firecrawl), that provider instead      |
| A picture found by a search, or one the AI inserts by address, is put in your document | A download request for that picture                                                                            | The website that hosts the picture                                                                                                                                                                                |
| An image is generated (needs a key-based image provider in this version)               | The description of the image and any reference pictures                                                        | The image provider whose key you entered                                                                                                                                                                          |
| The AI is asked to look at a picture, a video or a sound file                          | That file and the question about it                                                                            | Pictures: the AI provider in use, or the key-based analysis provider you chose. Video and sound: only a key-based provider that can analyse video                                                                 |
| The installed app checks for a new version                                             | An ordinary request for the public release list; a new installer is downloaded when you accept an update       | **GitHub** (the releases of `pblsketch/openoffice`)                                                                                                                                                               |
| You set up an image upload host in the Markdown editor                                 | The pictures you paste or drop into a Markdown document                                                        | The host you configured: S3-compatible storage, SM.MS, or a GitHub repository. Nothing is uploaded when no host is configured; pictures are kept next to the document                                             |
| You switched on reranking for the home screen's file search (off by default)           | The search query and excerpts of the top 20 local matches                                                      | The reranking service you chose and entered a key for                                                                                                                                                             |

Every one of these is a direct connection, so the receiving service sees your
public IP address, as any website you visit does.

Parts of a document that you marked as hidden from AI, in the editors that
offer that marking, are withheld from the request whichever provider is used.

Three more things can cause network traffic that is not a request made by the
app's own features:

- **Install and Sign in buttons.** Install runs the vendor's official install
  command in a terminal window you can see (`irm https://claude.ai/install.ps1 | iex`
  for Claude Code, `winget install OpenAI.Codex` for Codex); the download is
  done by that command, not by the app. Sign in starts the vendor program's
  own sign-in, which opens the vendor's page in your browser.
- **Claude Code and Codex themselves.** They are separate programs from
  Anthropic and OpenAI. The app controls what it hands to them, not what else
  they exchange with their makers; their own terms and privacy policies apply.
- **Documents that point at online content.** An HTML document is a web page:
  when it is shown, it loads whatever online resources its own code refers
  to. Exporting a Markdown document that contains pictures by web address
  downloads those pictures from where they are hosted. The spell checker of
  the Word editor is the one built into the app's browser engine, which may
  download dictionary files from a Google server.

## What IeumOffice never does

- It has no usage analytics and no telemetry: no launch counts, no file
  statistics, no install identifier.
- It never reads, copies or stores your Claude or Codex login: not
  `~/.codex/auth.json`, not the Claude credential store, not a session token.
  It has no Claude or ChatGPT sign-in form of its own. It only starts the
  vendor's unmodified program, which signs in by itself.
- When it asks those programs whether you are signed in, it keeps only the
  program's version, the kind of login (subscription or billed by usage) and
  the plan name. The account e-mail address the programs report is shown on
  the connection card under Settings → AI and nowhere else, so you can see
  which account is signed in. It is held in memory while the app runs and is
  never stored: not in a settings file, a log or a record, and not in the
  output of a terminal command or an MCP tool. The organisation name the
  programs report is discarded.
- The connection card can sign the vendor's program out, or sign it in with
  another account. Both run the vendor's own command and apply to that
  program on the whole PC, so the app asks you first. It still never sees the
  login itself.
- It asks those programs which models they offer, to show their real names in
  the model list. That question goes to the program on your PC; it is not an
  AI request and sends none of your content.
- It never moves your AI chat to a connection that costs money on its own.
  API-key providers, and a Claude or Codex login that is billed by usage, are
  used only after you choose them yourself.
- It does not start AI requests in the background. A request starts when you
  ask for it on screen. Requests made by a terminal command or an MCP client
  are requests you (or the agent you run) made; those can use a subscription
  only after you switch that on under Settings → AI → Advanced.

## Whether your content is used for AI training

IeumOffice does not decide this. When you use a subscription, your content is
sent under your own Anthropic or OpenAI account, and whether it may be used to
train models is set by **your account settings at that company**. Check them
there. The same holds for any API-key provider you add.

## What Claude Code and Codex keep on your PC

- **Claude Code** is started without session persistence, so it does not save
  the conversation to its session files.
- **Codex** is started with conversation-history saving switched off and with
  throw-away (ephemeral) threads. Codex still keeps a diagnostic log database
  of its own on your PC; the project could not inspect what it contains.

## What stays on your PC

Nothing in this list is uploaded by the app.

- **Your documents**, wherever you save them, together with the helper files
  some editors keep next to a document.
- **AI chat history**, kept in the app's data folder
  (`%APPDATA%\IeumOffice`).
- **Settings, including any API keys you entered**
  (`ai-settings.json` in the same folder). The keys are stored as plain text,
  not encrypted, so anyone who can read your user profile can read them.
- **The record that you accepted a login billed by usage**, kept in the same
  folder. It is cleared when the kind of login changes or you sign out.
- **The automatic-call ledger**: the times of subscription requests made by
  terminal commands and MCP clients during the last hour, used to enforce the
  hourly limit. It holds no content.
- **The search index** of the folders you added to the home screen, autosave
  copies, recent-file lists and local diagnostic logs, also in the data
  folder.
- **The command-line audit log** (`~/.ieumoffice/cli-audit.jsonl`): one line
  per `ieumoffice` command with the time, the arguments, the result and the
  output path. Set `GENOFFICE_AUDIT_LOG=off` to disable it.

Uninstalling the app does not necessarily delete these folders; remove them
yourself if you want them gone.

## Builds from source and forks

This page describes the code in this repository. A build that someone else
made from modified code can behave differently; the party that distributes it
is responsible for saying so.

## Questions

Open an issue at
[github.com/pblsketch/openoffice/issues](https://github.com/pblsketch/openoffice/issues).
For a suspected security problem, follow [SECURITY.md](SECURITY.md) instead.
