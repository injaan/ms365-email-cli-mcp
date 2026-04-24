#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { execFileSync, spawnSync } = require("child_process");

const server = new Server(
  { name: "ms365-email-cli", version: "1.0.0" },
  {
    capabilities: { tools: {} },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_emails",
      description:
        "List recent emails (all statuses, newest first). Output includes ID, From, Subject, Received, Status for each email.",
      inputSchema: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description: "Number of emails to list (default 10)",
          },
        },
      },
    },
    {
      name: "list_unread_emails",
      description:
        "List unread emails (newest first). Output includes ID, From, Subject, Received. [+attachments] shown for file attachments.",
      inputSchema: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description: "Number of unread emails to list (default 10)",
          },
        },
      },
    },
    {
      name: "read_email",
      description:
        "Read full email content by message ID. Shows: From, To, CC, Subject, Date, Body, Attachments.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "Message ID (get from list_emails or list_unread_emails)",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "thread",
      description:
        "Show full conversation thread for an email. Fetches all messages in the same conversation, sorted oldest first.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Message ID of any email in the thread",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "mark_read",
      description: "Mark an email as read by message ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "Message ID to mark as read (get from list_emails or list_unread_emails)",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "search_emails",
      description:
        "Search emails by various criteria. Use query for full-text search or combine from/subject/since filters.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Full-text search across subject, body, sender",
          },
          from: {
            type: "string",
            description: "Filter by sender email address",
          },
          subject: { type: "string", description: "Filter by subject text" },
          since: {
            type: "string",
            description: "Filter emails since date (YYYY-MM-DD)",
          },
          folder: {
            type: "string",
            enum: ["inbox", "sent"],
            description: "Folder to search: inbox or sent (default: inbox)",
          },
          count: {
            type: "number",
            description: "Max results to return (default: 20)",
          },
        },
      },
    },
    {
      name: "send_email",
      description: "Send an email via MS365 mailbox.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          cc: {
            anyOf: [
              { type: "string" },
              {
                type: "array",
                items: { type: "string" },
              },
            ],
            description:
              "CC recipient email address(es); supports repeatable values and comma-separated entries",
          },
          subject: { type: "string", description: "Email subject" },
          body: {
            type: "string",
            description: "Email body (plain text or HTML)",
          },
          html: {
            type: "boolean",
            description: "Send body as HTML (default: false)",
          },
          attachments: {
            type: "array",
            items: { type: "string" },
            description: "List of file paths to attach",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
    {
      name: "reply",
      description:
        "Reply to the sender of an email (reply to original sender only).",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Message ID of the email to reply to",
          },
          body: {
            type: "string",
            description: "Reply body text (plain text or HTML)",
          },
          html: {
            type: "boolean",
            description: "Send body as HTML (default: false)",
          },
          attachments: {
            type: "array",
            items: { type: "string" },
            description: "List of file paths to attach",
          },
        },
        required: ["id", "body"],
      },
    },
    {
      name: "reply_all",
      description:
        "Reply to all recipients of an email (original sender, To, and CC recipients).",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Message ID of the email to reply to",
          },
          body: {
            type: "string",
            description: "Reply body text (plain text or HTML)",
          },
          html: {
            type: "boolean",
            description: "Send body as HTML (default: false)",
          },
          attachments: {
            type: "array",
            items: { type: "string" },
            description: "List of file paths to attach",
          },
        },
        required: ["id", "body"],
      },
    },
    {
      name: "attachment",
      description:
        "List or download attachments from an email. Lists attachments if no output directory is set; downloads to directory if output is set.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Message ID of the email" },
          output_dir: {
            type: "string",
            description:
              "Directory path to download attachments to (omit to just list attachments)",
          },
        },
        required: ["id"],
      },
    },
  ],
}));

function normalizeEmailList(value) {
  if (!value) return [];

  const items = Array.isArray(value) ? value : [value];

  return items
    .flatMap((item) => String(item).split(","))
    .map((email) => email.trim())
    .filter(Boolean);
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const cmdArgs = [];

  try {
    if (name === "list_emails") {
      cmdArgs.push("list");
      if (args.count) cmdArgs.push("-n", String(args.count));
    } else if (name === "list_unread_emails") {
      cmdArgs.push("unread");
      if (args.count) cmdArgs.push("-n", String(args.count));
    } else if (name === "read_email") {
      cmdArgs.push("read", args.id);
    } else if (name === "thread") {
      cmdArgs.push("thread", args.id);
    } else if (name === "mark_read") {
      cmdArgs.push("mark-read", args.id);
    } else if (name === "search_emails") {
      cmdArgs.push("search");
      if (args.query) cmdArgs.push("-q", args.query);
      if (args.from) cmdArgs.push("--from", args.from);
      if (args.subject) cmdArgs.push("--subject", args.subject);
      if (args.since) cmdArgs.push("--since", args.since);
      if (args.folder) cmdArgs.push("--folder", args.folder);
      if (args.count) cmdArgs.push("-n", String(args.count));
    } else if (name === "send_email") {
      cmdArgs.push("send", "-t", args.to, "-s", args.subject, "-b", args.body);
      const ccRecipients = normalizeEmailList(args.cc);
      for (const cc of ccRecipients) {
        cmdArgs.push("-c", cc);
      }
      if (args.html) cmdArgs.push("--html");
      if (args.attachments && args.attachments.length > 0) {
        for (const file of args.attachments) {
          cmdArgs.push("-a", file);
        }
      }
    } else if (name === "reply") {
      cmdArgs.push("reply", args.id, "-b", args.body);
      if (args.html) cmdArgs.push("--html");
      if (args.attachments && args.attachments.length > 0) {
        for (const file of args.attachments) {
          cmdArgs.push("-a", file);
        }
      }
    } else if (name === "reply_all") {
      cmdArgs.push("reply-all", args.id, "-b", args.body);
      if (args.html) cmdArgs.push("--html");
      if (args.attachments && args.attachments.length > 0) {
        for (const file of args.attachments) {
          cmdArgs.push("-a", file);
        }
      }
    } else if (name === "attachment") {
      cmdArgs.push("attachment", args.id);
      if (args.output_dir) cmdArgs.push("-o", args.output_dir);
    } else {
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }

    const cliCommand = process.platform === "win32" ? "ms365-email-cli.cmd" : "ms365-email-cli";
    const spawnArgs = process.platform === "win32" ? ["/c", cliCommand, ...cmdArgs] : cmdArgs;
    const spawnCmd = process.platform === "win32" ? "cmd" : cliCommand;
    const result = spawnSync(spawnCmd, spawnArgs, { encoding: "utf-8" });
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    const output = (result.stdout || "") + (result.stderr || "");
    
    if (result.status !== 0 && result.stderr) {
      throw new Error(result.stderr.trim());
    }
    
    return { content: [{ type: "text", text: output }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
