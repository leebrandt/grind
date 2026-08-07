#!/usr/bin/env bun
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from "commander";
import { GrindError } from "./utils/errors.js";
import {
  DEFAULT_PROJECT_TYPES,
  isValidProjectType,
  getEffectiveProjectTypes,
} from "./types/index.js";
import { requireWorkspace } from "./utils/workspace.js";
import { readGrindConfig } from "./utils/config.js";
import type { ProjectType } from "./types/index.js";
import { newIdea, newProject, newIssue, newFeature } from "./commands/new.js";
import { listIdeas, listProjects } from "./commands/list.js";
import { workStart } from "./commands/work.js";
import { save } from "./commands/save.js";
import { init } from "./commands/init.js";
import { configList, configGet, configSet, resolveProjectArg } from "./commands/config.js";
import { rejectIdea } from "./commands/reject.js";
import { pruneIdeas } from "./commands/prune.js";
import { publishProject } from "./commands/publish-project.js";
import { cancelProject } from "./commands/cancel.js";
import { invoiceProject } from "./commands/invoice.js";
import { editIdea, editProject } from "./commands/edit.js";
import { openCode } from "./commands/code.js";
import { journal } from "./commands/journal.js";
import { readJournal } from "./commands/read.js";
import { status } from "./commands/status.js";
import { clone } from "./commands/clone.js";
import { pushProjects } from "./commands/push.js";
import { pullProjects } from "./commands/pull.js";
import { cleanup } from "./commands/cleanup.js";
import { migrate } from "./commands/migrate.js";
import { showProject } from "./commands/show.js";
import { listAllTasks, listProjectTasks, addTaskToProject, completeProjectTask } from "./commands/tasks.js";
import { wwd } from "./commands/wwd.js";
import packageJson from "../package.json" with { type: "json" };

const program = new Command();

program
  .name("grind")
  .description(
    "CLI tool for managing creative/technical projects from idea to publication",
  )
  .version(packageJson.version, "-v, --version", "Display version number")
  .on("command:*", () => {
    program.help({ error: true });
  });

// grind init [-u <url>]
program
  .command("init")
  .description(
    "Initialize a grind workspace (creates ideas/, projects/, .grind.json)",
  )
  .option("-u, --url <url>", "Remote repository URL")
  .action(async (options: { url?: string }) => {
    await init(options.url);
  });

// grind clone <url> [directory]
program
  .command("clone <url> [directory]")
  .description("Clone an existing grind workspace from a remote repository")
  .action(async (url: string, directory?: string) => {
    await clone(url, directory);
  });

// grind push [-u <url>]
program
  .command("push")
  .description("Push all branches to remote")
  .option("-u, --url <url>", "Remote URL (overrides configured remote)")
  .action(async (options: { url?: string }) => {
    await pushProjects(options);
  });

// grind pull [-u <url>]
program
  .command("pull")
  .description("Pull all branches and restore project worktrees")
  .option("-u, --url <url>", "Remote URL (overrides configured remote)")
  .action(async (options: { url?: string }) => {
    await pullProjects(options);
  });

// grind cleanup [--dry-run] [-y]
program
  .command("cleanup")
  .description("Remove stale remote and local branches (branches without project configs on main)")
  .option("--dry-run", "Show what would be deleted without making changes")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (options: { dryRun?: boolean; yes?: boolean }) => {
    await cleanup(options);
  });

// grind migrate
program
  .command("migrate")
  .description("One-time migration: move project configs from project worktrees to main")
  .action(async () => {
    await migrate();
  });

// grind config <project> <key> <value>    # Set project config
// grind config <project> <key>            # Get project config
// grind config <project> --list           # Show project config
// grind config -g <key> <value>           # Set workspace config
// grind config -g <key>                   # Get workspace config
// grind config -g --list                  # Show workspace config
program
  .command("config [project] [key] [value]")
  .description("Get or set configuration values")
  .option(
    "-g, --global",
    "Use workspace config (.grind.json) instead of project config",
  )
  .option("-l, --list", "List all config values")
  .option("-p, --project <name>", "Project name (alternative to positional [project])")
  .addHelpText(
    "after",
    `
Settable keys (project-level):
  type                  blog, webapp, video, song, book
  billing.roundTo       quarter-hour, half-hour, hour
  billing.rate          hourly rate (number)
  client.contact        client contact person name
  client.company        client company name
  client.address        client address
  client.phone          client phone number
  client.email          client email address
  repo                  git remote URL (e.g. git@github.com:owner/repo.git)
  code                  code directory (relative to project, e.g. "src")
  longTerm              true/false (mark as long-running project, shows ★)
  deadline              project deadline (YYYY-MM-DD)

Settable keys (workspace-level, use -g):
  billing.roundTo       quarter-hour, half-hour, hour
  billing.defaultRate   default hourly rate (number)
  projectTypes          comma-separated list of types (e.g. "blog,webapp,video")
  my.name               your name
  my.company            your company name
  my.address            your address
  my.phone              your phone number
  my.email              your email address
  my.taxId              tax ID (ABN/EIN/VAT)
  currency              currency code (e.g. USD, AUD)
  paymentTerms          payment terms (e.g. "Net 30")
  remote.url            remote repository URL (for push/pull)
`,
  )
  .action(
    async (
      project: string | undefined,
      key: string | undefined,
      value: string | undefined,
      options: { global?: boolean; list?: boolean; project?: string },
    ) => {
      const resolvedProject = resolveProjectArg(project, options.project, !!options.global);

      if (options.global) {
        if (options.list || (!key && !value)) {
          await configList(null, options);
        } else if (key && !value) {
          await configGet(key, null, options);
        } else if (key && value) {
          await configSet(key, value, null, options);
        }
      } else {
        if (!resolvedProject) {
          throw new GrindError("Project name is required (or use -g for workspace config)", 1);
        }
        if (options.list || (!key && !value)) {
          await configList(resolvedProject, options);
        } else if (key && !value) {
          await configGet(key, resolvedProject, options);
        } else if (key && value) {
          await configSet(key, value, resolvedProject, options);
        }
      }
    },
  );

// grind new idea "title"
// grind new project "name" <idea-number> [-t type]
const newCmd = program
  .command("new")
  .description("Create a new idea or project");

newCmd
  .command("idea [title]")
  .description("Create a new idea file")
  .action(async (title?: string) => {
    await newIdea(title);
  });

newCmd
  .command("project <name> <idea-number>")
  .description(
    "Create a new project from an idea (use number from 'grind list ideas')",
  )
  .option(
    "-t, --type <type>",
    `Project type (${DEFAULT_PROJECT_TYPES.join(", ")})`,
  )
  .action(
    async (name: string, ideaNumber: string, options: { type?: string }) => {
      const { mainWorktree } = await requireWorkspace();
      const grindConfig = await readGrindConfig(mainWorktree);
      const validTypes = getEffectiveProjectTypes(grindConfig);
      if (options.type && !isValidProjectType(options.type, validTypes)) {
        throw new GrindError(
          `Invalid type: ${options.type}. Valid types: ${validTypes.join(", ")}`,
          1,
        );
      }
      await newProject(name, ideaNumber, {
        type: options.type as ProjectType | undefined,
      });
    },
  );

newCmd
  .command("issue <project>")
  .description("Create a new idea and GitHub issue for a project")
  .option(
    "-m, --message <message>",
    "Issue title/message (opens editor if omitted)",
  )
  .action(async (project: string, options: { message?: string }) => {
    await newIssue(project, options);
  });

newCmd
  .command("feature <project>")
  .description("Create a new idea and GitHub feature request for a project")
  .option(
    "-m, --message <message>",
    "Feature title/message (opens editor if omitted)",
  )
  .action(async (project: string, options: { message?: string }) => {
    await newFeature(project, options);
  });

// grind list ideas
const listCmd = program.command("list").description("List ideas or projects");

listCmd
  .command("ideas")
  .description("List all idea files for triage")
  .option("-a, --all", "Show all ideas (rejected and non-rejected)")
  .option("-r, --rejected", "Show only rejected ideas")
  .action(async (options: { all?: boolean; rejected?: boolean }) => {
    await listIdeas(options);
  });

program
  .command("ideas")
  .description("List all idea files for triage")
  .option("-a, --all", "Show all ideas (rejected and non-rejected)")
  .option("-r, --rejected", "Show only rejected ideas")
  .action(async (options: { all?: boolean; rejected?: boolean }) => {
    await listIdeas(options);
  });

listCmd
  .command("projects")
  .description("List all projects")
  .action(async () => {
    await listProjects();
  });

program
  .command("projects")
  .description("List all projects")
  .action(async () => {
    await listProjects();
  });

// grind work <project> [-c] [-q] [-s]
program
  .command("work <project>")
  .description("Start working on a project (starts timer, opens editor)")
  .option("-c, --code", "Open code directory instead of project directory")
  .option("-q, --quiet", "Open editor without starting a timer")
  .option("-s, --save", "Save work (end timer, commit, push)")
  .action(
    async (
      project: string,
      options: { code?: boolean; quiet?: boolean; save?: boolean },
    ) => {
      await workStart(project, options);
    },
  );

// grind edit [target] — opens project writing dir or idea
const editCmd = program
  .command("edit [target]")
  .description("Open a project or idea in editor");

editCmd
  .command("idea <number>")
  .description("Open an idea file in $EDITOR")
  .action(async (number: string) => {
    await editIdea(number);
  });

editCmd.action(async (target?: string) => {
  if (!target) {
    editCmd.help();
  } else {
    await editProject(target);
  }
});

// grind code <project>
program
  .command("code <project>")
  .description("Open code editor in project's code directory")
  .action(async (project: string) => {
    await openCode(project);
  });

// grind save "project" [hours] [-q] [-y] [-t <hours>] [--no-push]
program
  .command("save <project> [hours]")
  .description("Save work on a project (stops timer, commits changes, pushes to remote)")
  .option("-q, --quiet", "Use auto-generated commit message (quick save)")
  .option("-y, --yes", "Skip interactive commit (same as --quiet)")
  .option(
    "-t, --time <hours>",
    "Backfill: set session end time to start + N hours (e.g. -t 5, -t 1h30m)",
  )
  .option("--no-push", "Skip pushing to remote (commit only)")
  .allowExcessArguments(false)
  .action(
    async (
      project: string,
      hours: string | undefined,
      options: { quiet?: boolean; yes?: boolean; time?: string; push?: boolean },
    ) => {
      await save(project, { ...options, hours });
    },
  );

// grind publish <name> [-d] [-D] [-u <url>] [-y]
program
  .command("publish <name>")
  .description(
    "Merge project branch to main (optionally delete worktree/branch)",
  )
  .option("-d, --delete-worktree", "Delete worktree after merging")
  .option("-D, --delete-branch", "Delete worktree and branch after merging")
  .option("-u, --url <url>", "URL where this project was published")
  .option("-y, --yes", "Skip confirmation before deleting worktree")
  .action(
    async (
      name: string,
      options: {
        deleteWorktree?: boolean;
        deleteBranch?: boolean;
        url?: string;
        yes?: boolean;
      },
    ) => {
      await publishProject(name, options);
    },
  );

// grind cancel <name> [--force] [-y]
program
  .command("cancel <name>")
  .description(
    "Cancel (abandon) a project — removes worktree, branch, and config",
  )
  .option("-f, --force", "Force removal even with uncommitted changes")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(
    async (name: string, options: { force?: boolean; yes?: boolean }) => {
      await cancelProject(name, options);
    },
  );

// grind reject idea [number]
const rejectCmd = program
  .command("reject")
  .description("Reject an idea or project");

rejectCmd
  .command("idea <number>")
  .description("Reject an idea (prepends 'rejected-' to filename)")
  .action(async (number: string) => {
    await rejectIdea(number);
  });

// grind prune ideas
const pruneCmd = program
  .command("prune")
  .description("Delete rejected ideas or projects");

pruneCmd
  .command("ideas")
  .description("Delete all rejected ideas (files starting with 'rejected-')")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (options: { yes?: boolean }) => {
    await pruneIdeas(options);
  });

// grind invoice <project>
program
  .command("invoice <project>")
  .description("Generate invoice for a project")
  .action(async (project: string) => {
    await invoiceProject(project);
  });

// grind journal
program
  .command("journal")
  .description("Open today's journal entry in $EDITOR")
  .action(async () => {
    await journal();
  });

// grind read journal [-r]
const readCmd = program
  .command("read")
  .description("Review journal, ideas, and projects");

readCmd
  .command("journal")
  .description("Print all journal entries to stdout (oldest first)")
  .option("-r, --reverse", "Print newest first")
  .action(async (options: { reverse?: boolean }) => {
    await readJournal(options);
  });

readCmd.action(() => {
  readCmd.help();
});

// grind status
program
  .command("status")
  .description("Show project overview")
  .action(async () => {
    await status();
  });

// grind wwd (status + tasks dashboard)
program
  .command("wwd")
  .description("What we doing? — status + tasks dashboard")
  .action(async () => {
    await wwd();
  });

// grind tasks list [project]
// grind tasks add <project> "description" [-d <date>]
// grind tasks done <project> <id>
const tasksCmd = program
  .command("tasks")
  .description("List or manage tasks");

tasksCmd
  .command("list [project]")
  .description("List tasks (all projects, or a specific project)")
  .option("-a, --all", "Include completed tasks")
  .action(async (project: string | undefined, options: { all?: boolean }) => {
    if (project) {
      await listProjectTasks(project, options);
    } else {
      await listAllTasks(options);
    }
  });

tasksCmd
  .command("add <project> <description>")
  .description("Add a task to a project")
  .option("-d, --due <date>", "Due date")
  .action(async (project: string, description: string, options: { due?: string }) => {
    await addTaskToProject(project, description, options);
  });

tasksCmd
  .command("done <project> <id>")
  .description("Mark a task as complete")
  .action(async (project: string, id: string) => {
    await completeProjectTask(project, id);
  });

// grind show <project>
program
  .command("show <project>")
  .description("Show project info (default: idea). Flags: --sessions, --billing, --config")
  .option("-s, --sessions", "Show session details")
  .option("-b, --billing", "Show billing summary")
  .option("-c, --config", "Show project config")
  .action(async (project: string, options: { sessions?: boolean; billing?: boolean; config?: boolean }) => {
    await showProject(project, options);
  });

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof GrindError) {
    console.error(`Error: ${error.message}`);
    process.exit(error.exitCode);
  } else if (error instanceof Error) {
    console.error(`Unexpected error: ${error.message}`);
    console.error(error.stack);
    process.exit(99);
  } else {
    console.error("Unexpected error:", error);
    process.exit(99);
  }
}
