# @injaan.dev/ms365-email-cli-mcp

Model Context Protocol (MCP) server wrapper for `ms365-email-cli`.

This package exposes mailbox operations as MCP tools and executes the local `ms365-email-cli` command under the hood.

## Prerequisites

- Node.js 18+
- `ms365-email-cli` installed and available in your shell `PATH`
- MS365 CLI config already initialized (`ms365-email-cli init`)

## Install

Local project install:

```bash
npm install
```

Global CLI install from npm:

```bash
npm install -g @injaan.dev/ms365-email-cli-mcp
```

## Run

From source:

```bash
npm start
```

From global install:

```bash
ms365-email-cli-mcp
```

The server uses stdio transport and is intended to be launched by an MCP-compatible client.

## Configure in AI agents (Claude Code, OpenAI Codex, GitHub Copilot)

This package is an MCP **stdio** server. Most clients only need a command that starts it.

You can use either:

- Global binary (recommended): `ms365-email-cli-mcp`
- Source command: `node /absolute/path/to/ms365-email-cli-mcp/index.js`

Before configuring any client, verify these are available in the same environment where your AI client runs:

- `ms365-email-cli-mcp`
- `ms365-email-cli`

### 1) Claude Code

Add the server (stdio):

```bash
# If installed globally
claude mcp add --transport stdio ms365-email-cli -- ms365-email-cli-mcp

# Or run from source
claude mcp add --transport stdio ms365-email-cli -- node /absolute/path/to/ms365-email-cli-mcp/index.js
```

Useful management commands:

```bash
claude mcp list
claude mcp get ms365-email-cli
```

If you prefer shared project config, Claude Code can also use a project `.mcp.json`:

```json
{
  "mcpServers": {
    "ms365-email-cli": {
      "type": "stdio",
      "command": "ms365-email-cli-mcp"
    }
  }
}
```

### 2) OpenAI Codex (CLI / extension)

Option A - add via CLI:

```bash
# If installed globally
codex mcp add ms365-email-cli -- ms365-email-cli-mcp

# Or run from source
codex mcp add ms365-email-cli -- node /absolute/path/to/ms365-email-cli-mcp/index.js
```

Option B - add in `~/.codex/config.toml` (or project `.codex/config.toml`):

```toml
[mcp_servers."ms365-email-cli"]
command = "ms365-email-cli-mcp"

# Alternative source-based form:
# [mcp_servers."ms365-email-cli"]
# command = "node"
# args = ["/absolute/path/to/ms365-email-cli-mcp/index.js"]
```

Check active servers:

```bash
codex mcp --help
```

### 3) GitHub Copilot in VS Code

Create `.vscode/mcp.json` in your workspace (or use MCP: Open User Configuration):

```json
{
  "servers": {
    "ms365-email-cli": {
      "type": "stdio",
      "command": "ms365-email-cli-mcp"
    }
  }
}
```

Source-based alternative:

```json
{
  "servers": {
    "ms365-email-cli": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/ms365-email-cli-mcp/index.js"]
    }
  }
}
```

Then in VS Code:

1. Run **MCP: List Servers** from Command Palette.
2. Start/trust `ms365-email-cli`.
3. Open Chat and use the tools.

### Quick verification prompt (any client)

Try asking your agent:

- "List my last 5 emails"
- "Show unread emails"

If tools do not appear, confirm your client process can resolve both `ms365-email-cli-mcp` and `ms365-email-cli` in `PATH`.

## Available MCP tools

- `list_emails`
- `list_unread_emails`
- `read_email`
- `thread`
- `mark_read`
- `search_emails`
- `send_email` (supports `to`, `cc`, `subject`, `body`, `html`, `attachments`)
- `reply`
- `reply_all`
- `attachment`

## Notes

- `send_email.cc` supports either:
  - a single string (`"manager@example.com"`)
  - comma-separated string (`"a@example.com,b@example.com"`)
  - array of strings (`["a@example.com", "b@example.com"]`)
- Each CC value is forwarded to the CLI as repeatable `-c` flags.
- Errors from the CLI are returned to MCP as tool errors.

## Example MCP tool call shape (send_email)

```json
{
  "name": "send_email",
  "arguments": {
    "to": "user@example.com",
    "cc": ["manager@example.com", "audit@example.com"],
    "subject": "Hello",
    "body": "Email body",
    "html": false,
    "attachments": ["./report.pdf"]
  }
}
```

## Publish Checklist

1. Authenticate with npm:

   ```bash
   npm login
   ```

2. Verify the package contents:

   ```bash
   npm pack --dry-run
   ```

3. Publish:

   ```bash
   npm publish
   ```

4. For updates, bump version first:

   ```bash
   npm version patch
   npm publish
   ```
