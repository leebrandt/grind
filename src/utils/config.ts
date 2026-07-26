// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { readFile, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { GrindConfig, ProjectConfig } from "../types/index.js";
import {
  getGrindConfigPath,
  getProjectConfigPath,
} from "./paths.js";

/**
 * Write a file atomically: write to temp file, then rename.
 * POSIX rename is atomic, so a crash mid-write won't corrupt the target.
 */
async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, data, "utf-8");
  await rename(tmp, filePath);
}

export async function readGrindConfig(rootPath: string): Promise<GrindConfig> {
  const configPath = getGrindConfigPath(rootPath);
  const content = await readFile(configPath, "utf-8");
  return JSON.parse(content);
}

export async function writeGrindConfig(rootPath: string, config: GrindConfig): Promise<void> {
  const configPath = getGrindConfigPath(rootPath);
  await atomicWrite(configPath, JSON.stringify(config, null, 2) + "\n");
}

export async function readProjectConfig(
  workspaceRoot: string,
  projectName: string
): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath(workspaceRoot, projectName);

  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function writeProjectConfig(
  workspaceRoot: string,
  projectName: string,
  config: ProjectConfig
): Promise<void> {
  const configPath = getProjectConfigPath(workspaceRoot, projectName);
  await atomicWrite(configPath, JSON.stringify(config, null, 2) + "\n");
}

export async function resolveProjectConfig(
  workspaceRoot: string,
  projectName: string
): Promise<{ config: ProjectConfig; sourcePath: string } | null> {
  const configPath = getProjectConfigPath(workspaceRoot, projectName);

  try {
    const content = await readFile(configPath, "utf-8");
    return { config: JSON.parse(content), sourcePath: configPath };
  } catch {
    return null;
  }
}
