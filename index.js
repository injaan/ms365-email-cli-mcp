#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { execSync } = require("child_process");

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

function shellEscape(str) {
  return String(str).replace(/'/g, "'\\''");
}

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
  let cmd = "ms365-email-cli";

  try {
    if (name === "list_emails") {
      cmd += " list";
      if (args.count) cmd += ` -n ${args.count}`;
    } else if (name === "list_unread_emails") {
      cmd += " unread";
      if (args.count) cmd += ` -n ${args.count}`;
    } else if (name === "read_email") {
      cmd += ` read '${shellEscape(args.id)}'`;
    } else if (name === "thread") {
      cmd += ` thread '${shellEscape(args.id)}'`;
    } else if (name === "mark_read") {
      cmd += ` mark-read '${shellEscape(args.id)}'`;
    } else if (name === "search_emails") {
      cmd += " search";
      if (args.query) cmd += ` -q '${shellEscape(args.query)}'`;
      if (args.from) cmd += ` --from '${shellEscape(args.from)}'`;
      if (args.subject) cmd += ` --subject '${shellEscape(args.subject)}'`;
      if (args.since) cmd += ` --since '${shellEscape(args.since)}'`;
      if (args.folder) cmd += ` --folder '${shellEscape(args.folder)}'`;
      if (args.count) cmd += ` -n ${args.count}`;
    } else if (name === "send_email") {
      cmd += ` send -t '${shellEscape(args.to)}' -s '${shellEscape(args.subject)}' -b '${shellEscape(args.body)}'`;
      const ccRecipients = normalizeEmailList(args.cc);
      for (const cc of ccRecipients) {
        cmd += ` -c '${shellEscape(cc)}'`;
      }
      if (args.html) cmd += " --html";
      if (args.attachments && args.attachments.length > 0) {
        for (const file of args.attachments) {
          cmd += ` -a '${shellEscape(file)}'`;
        }
      }
    } else if (name === "reply") {
      cmd += ` reply '${shellEscape(args.id)}' -b '${shellEscape(args.body)}'`;
      if (args.html) cmd += " --html";
      if (args.attachments && args.attachments.length > 0) {
        for (const file of args.attachments) {
          cmd += ` -a '${shellEscape(file)}'`;
        }
      }
    } else if (name === "reply_all") {
      cmd += ` reply-all '${shellEscape(args.id)}' -b '${shellEscape(args.body)}'`;
      if (args.html) cmd += " --html";
      if (args.attachments && args.attachments.length > 0) {
        for (const file of args.attachments) {
          cmd += ` -a '${shellEscape(file)}'`;
        }
      }
    } else if (name === "attachment") {
      cmd += ` attachment '${shellEscape(args.id)}'`;
      if (args.output_dir) cmd += ` -o '${shellEscape(args.output_dir)}'`;
    } else {
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }

    const output = execSync(cmd, { encoding: "utf-8" });
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
