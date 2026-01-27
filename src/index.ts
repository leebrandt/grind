#!/usr/bin/env bun
import { Command } from "commander";
import { PROJECT_TYPES, isValidProjectType } from "./types/index.js";
import type { ProjectType } from "./types/index.js";
import { newIdea, newProject } from "./commands/new.js";
import { listIdeas, listProjects } from "./commands/list.js";
import { workStart } from "./commands/work.js";
import { save } from "./commands/save.js";
import { review } from "./commands/review.js";
import { finalize } from "./commands/finalize.js";
import { publish } from "./commands/publish.js";
import { promo } from "./commands/promo.js";
import { init } from "./commands/init.js";
import { configList, configGet, configSet } from "./commands/config.js";

const program = new Command();

program
  .name("grind")
  .description("CLI tool for managing creative/technical projects from idea to publication")
  .version("0.1.0");

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
  .action(async (key: string | undefined, value: string | undefined, options: { global?: boolean; list?: boolean }) => {
    if (options.list || (!key && !value)) {
      await configList(options);
    } else if (key && !value) {
      await configGet(key, options);
    } else if (key && value) {
      await configSet(key, value, options);
    }
  });

// grind new idea "title" [-t type]
// grind new project "name" [idea-file] [-t type]
const newCmd = program.command("new").description("Create a new idea or project");

newCmd
  .command("idea <title>")
  .description("Create a new idea file")
  .option("-t, --type <type>", `Project type (${PROJECT_TYPES.join(", ")})`)
  .action(async (title: string, options: { type?: string }) => {
    if (options.type && !isValidProjectType(options.type)) {
      console.error(`Invalid type: ${options.type}. Valid types: ${PROJECT_TYPES.join(", ")}`);
      process.exit(1);
    }
    await newIdea(title, { type: options.type as ProjectType | undefined });
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
  .action(async () => {
    await listIdeas();
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
  .action(async (project: string) => {
    await save(project);
  });

// grind review "file"
program
  .command("review <file>")
  .description("Review a file (placeholder for LLM integration)")
  .action(async (file: string) => {
    await review(file);
  });

// grind finalize "file"
program
  .command("finalize <file>")
  .description("Finalize a file (placeholder for LLM integration)")
  .action(async (file: string) => {
    await finalize(file);
  });

// grind publish "file"
program
  .command("publish <file>")
  .description("Publish a file to site repos")
  .action(async (file: string) => {
    await publish(file);
  });

// grind promo "project"
program
  .command("promo <project>")
  .description("Trigger promo workflow for a project")
  .action(async (project: string) => {
    await promo(project);
  });

program.parse();
