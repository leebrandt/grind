#!/usr/bin/env bun
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Command } from "commander";
import { PROJECT_TYPES, isValidProjectType } from "./types/index.js";
import type { ProjectType } from "./types/index.js";
import { newIdea, newProject, newIssue, newFeature } from "./commands/new.js";
import { listIdeas, listProjects } from "./commands/list.js";
import { workStart } from "./commands/work.js";
import { save } from "./commands/save.js";
import { init } from "./commands/init.js";
import { configList, configGet, configSet } from "./commands/config.js";
import { rejectIdea } from "./commands/reject.js";
import { pruneIdeas } from "./commands/prune.js";
import { publishProject } from "./commands/publish-project.js";
import { cancelProject } from "./commands/cancel.js";
import { invoiceProject } from "./commands/invoice.js";
import { edit } from "./commands/edit.js";
import { journal } from "./commands/journal.js";
import { status } from "./commands/status.js";
import { clone } from "./commands/clone.js";
import packageJson from "../package.json" with { type: "json" };

const program = new Command();

program
  .name("grind")
  .description("CLI tool for managing creative/technical projects from idea to publication")
  .version(packageJson.version, "-v, --version", "Display version number");

// grind init
program
  .command("init")
  .description("Initialize a grind workspace (creates ideas/, projects/, .grind.json)")
  .action(async () => {
    await init();
  });

// grind clone <url> [directory]
program
  .command("clone <url> [directory]")
  .description("Clone an existing grind workspace from a remote repository")
  .action(async (url: string, directory?: string) => {
    await clone(url, directory);
  });

// grind config [key] [value] [-g/--global] [-p/--project] [--list]
program
  .command("config [key] [value]")
  .description("Get or set configuration values")
  .option("-g, --global", "Use workspace config (.grind.json) instead of project config")
  .option("-p, --project <name>", "Target a specific project (instead of detecting from cwd)")
  .option("-l, --list", "List all config values")
  .addHelpText("after", `
Settable keys (project-level):
  type                  blog, webapp, video, song, book
  billing.roundTo       quarter-hour, half-hour, hour
  billing.rate          hourly rate (number)
  client.contact        client contact person name
  client.company        client company name
  client.address        client address
  client.phone          client phone number
  client.email          client email address
  repo                  GitHub repository (owner/repo format)
  longTerm              true/false (mark as long-running project, shows ★)

Settable keys (workspace-level, use -g):
  billing.roundTo       quarter-hour, half-hour, hour
  billing.defaultRate   default hourly rate (number)
  my.name               your name
  my.company            your company name
  my.address            your address
  my.phone              your phone number
  my.email              your email address
  my.taxId              tax ID (ABN/EIN/VAT)
  currency              currency code (e.g. USD, AUD)
  paymentTerms          payment terms (e.g. "Net 30")
`)
  .action(async (key: string | undefined, value: string | undefined, options: { global?: boolean; project?: string; list?: boolean }) => {
    if (options.list || (!key && !value)) {
      await configList(options);
    } else if (key && !value) {
      await configGet(key, options);
    } else if (key && value) {
      await configSet(key, value, options);
    }
  });

// grind new idea "title"
// grind new project "name" <idea-number> [-t type]
const newCmd = program.command("new").description("Create a new idea or project");

newCmd
  .command("idea <title>")
  .description("Create a new idea file")
  .action(async (title: string) => {
    await newIdea(title);
  });

newCmd
  .command("project <name> <idea-number>")
  .description("Create a new project from an idea (use number from 'grind list ideas')")
  .option("-t, --type <type>", `Project type (${PROJECT_TYPES.join(", ")})`)
  .action(async (name: string, ideaNumber: string, options: { type?: string }) => {
    if (options.type && !isValidProjectType(options.type)) {
      console.error(`Invalid type: ${options.type}. Valid types: ${PROJECT_TYPES.join(", ")}`);
      process.exit(1);
    }
    await newProject(name, ideaNumber, { type: options.type as ProjectType | undefined });
  });

newCmd
  .command("issue <project>")
  .description("Create a new idea and GitHub issue for a project")
  .option("-m, --message <message>", "Issue title/message (opens editor if omitted)")
  .action(async (project: string, options: { message?: string }) => {
    await newIssue(project, options);
  });

newCmd
  .command("feature <project>")
  .description("Create a new idea and GitHub feature request for a project")
  .option("-m, --message <message>", "Feature title/message (opens editor if omitted)")
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

program.command("ideas")
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

program.command("projects")
  .description("List all projects")
  .action(async () => {
    await listProjects();
  });

// grind work "project" [-q|--quiet]
program
  .command("work <project>")
  .description("Start working on a project (starts timer, opens editor)")
  .option("-q, --quiet", "Start session without opening editor")
  .action(async (project: string, options: { quiet?: boolean }) => {
    await workStart(project, options);
  });

// grind edit "project"
program
  .command("edit <project>")
  .description("Open nvim in a project's working directory (no time tracking)")
  .action(async (project: string) => {
    await edit(project);
  });

// grind save "project"
program
  .command("save <project>")
  .description("Save work on a project (stops timer, commits changes)")
  .option("-q, --quiet", "Use auto-generated commit message (quick save)")
  .action(async (project: string, options: { quiet?: boolean }) => {
    await save(project, options);
  });

// grind publish <name> [-d] [-D]
program
  .command("publish <name>")
  .description("Merge project branch to main (optionally delete worktree/branch)")
  .option("-d, --delete-worktree", "Delete worktree after merging")
  .option("-D, --delete-branch", "Delete worktree and branch after merging")
  .action(async (name: string, options: { deleteWorktree?: boolean; deleteBranch?: boolean }) => {
    await publishProject(name, options);
  });

// grind cancel <name> [--force]
program
  .command("cancel <name>")
  .description("Cancel (abandon) a project — removes worktree, branch, and config")
  .option("-f, --force", "Force removal even with uncommitted changes")
  .action(async (name: string, options: { force?: boolean }) => {
    await cancelProject(name, options);
  });

// grind reject idea [number]
const rejectCmd = program.command("reject").description("Reject an idea or project");

rejectCmd
  .command("idea <number>")
  .description("Reject an idea (prepends 'rejected-' to filename)")
  .action(async (number: string) => {
    await rejectIdea(number);
  });

// grind prune ideas
const pruneCmd = program.command("prune").description("Delete rejected ideas or projects");

pruneCmd
  .command("ideas")
  .description("Delete all rejected ideas (files starting with 'rejected-')")
  .action(async () => {
    await pruneIdeas();
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
  .description("Open today's journal entry in nvim")
  .action(async () => {
    await journal();
  });

// grind status
program
  .command("status")
  .description("Show project overview")
  .action(async () => {
    await status();
  });

program.parse();
