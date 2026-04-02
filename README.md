# ms365-email-cli MCP Server

Model Context Protocol (MCP) server wrapper for `ms365-email-cli`.

This server exposes mailbox operations as MCP tools and executes the local `ms365-email-cli` command under the hood.

## Prerequisites

- Node.js 18+
- `ms365-email-cli` installed and available in your shell `PATH`
- MS365 CLI config already initialized (`ms365-email-cli init`)

## Install

```bash
npm install
```

## Run

```bash
node index.js
```

The server uses stdio transport and is intended to be launched by an MCP-compatible client.

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
