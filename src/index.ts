#!/usr/bin/env bun
import { Command } from "commander";
import { PROJECT_TYPES, isValidProjectType } from "./types/index.js";
import type { ProjectType } from "./types/index.js";
import { newIdea, newProject } from "./commands/new.js";
import { listIdeas, listProjects } from "./commands/list.js";
import { workStart } from "./commands/work.js";
import { save } from "./commands/save.js";
import { init } from "./commands/init.js";
import { configList, configGet, configSet } from "./commands/config.js";
import { rejectIdea } from "./commands/reject.js";
import { pruneIdeas } from "./commands/prune.js";
import { publishProject } from "./commands/publish-project.js";
import { invoiceProject } from "./commands/invoice.js";
import { journal } from "./commands/journal.js";
import { status } from "./commands/status.js";
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

// grind config [key] [value] [-g/--global] [--list]
program
  .command("config [key] [value]")
  .description("Get or set configuration values")
  .option("-g, --global", "Use workspace config (.grind.json) instead of project config")
  .option("-l, --list", "List all config values")
  .addHelpText("after", `
Settable keys (project-level):
  type                  blog, webapp, video, song, book
  billing.roundTo       quarter-hour, half-hour, hour
  billing.rate          hourly rate (number)

Settable keys (workspace-level, use -g):
  billing.roundTo       quarter-hour, half-hour, hour
  billing.defaultRate   default hourly rate (number)
`)
  .action(async (key: string | undefined, value: string | undefined, options: { global?: boolean; list?: boolean }) => {
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

listCmd
  .command("projects")
  .description("List all projects")
  .action(async () => {
    await listProjects();
  });

// grind work "project"
program
  .command("work <project>")
  .description("Start working on a project (starts timer, opens editor)")
  .action(async (project: string) => {
    await workStart(project);
  });

// grind save "project"
program
  .command("save <project>")
  .description("Save work on a project (stops timer, commits changes)")
  .option("-q, --quiet", "Use auto-generated commit message (quick save)")
  .action(async (project: string, options: { quiet?: boolean }) => {
    await save(project, options);
  });

// grind publish project <name> [-d|--delete]
const publishCmd = program.command("publish").description("Publish projects or files");

publishCmd
  .command("project <name>")
  .description("Merge project branch to main (optionally delete worktree)")
  .option("-d, --delete", "Delete worktree and branch after merging")
  .action(async (name: string, options: { delete?: boolean }) => {
    await publishProject(name, options);
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
  .description("Show git status for all worktrees")
  .action(async () => {
    await status();
  });

program.parse();
