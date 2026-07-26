// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs from "node:fs/promises";
import path from "node:path";  
import { readGrindConfig, writeGrindConfig, readProjectConfig, writeProjectConfig, resolveProjectConfig } from "../../src/utils/config.ts";

jest.mock("node:fs/promises");

describe('grind config utilities', () => {
  const workspaceRoot = "/home/user/work";
  const mainWorktree = path.join(workspaceRoot, "grind");
  const project = "my-project";
  const mainProjectConfigPath = path.join(mainWorktree, "projects", project, ".project.json");
  const grindConfigPath = path.join(mainWorktree, ".grind.json");
  let baseGrindConfig = {
    "billing": { 
      "defaultRate": 150, 
      "roundTo": "quarter-hour",
    }
  };
  let result;

  describe('the readGrindConfig function', () => {
    describe('the function successfully reading the file', () => {
      beforeEach(async () => {
        (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(baseGrindConfig));
        result = await readGrindConfig(mainWorktree);
      });
    
      afterEach(()=>{
        jest.restoreAllMocks();
      });

      it('should read the .grind.config file in the main workspace', async () => {
        expect(fs.readFile).toHaveBeenCalledWith(grindConfigPath, "utf-8");
      });

      it('should return the contents of the .grind.json file', async () => {
        expect(result).toEqual(baseGrindConfig);
      });
    });
    describe('the function failures', () => {
      beforeEach(async () => {
        (fs.readFile as jest.Mock).mockRejectedValue(new Error("TEST FAILURE"))
      });
    
      afterEach(()=>{
        jest.restoreAllMocks();
      });

      it('should throw an error if it is unable to write the config file', async () => {
          await expect(readGrindConfig(mainWorktree)).rejects.toThrow("TEST FAILURE");
      });
    });
  });

  describe('the readProjectConfig function', () => {
    beforeEach(async () => {
      (fs.readFile as jest.Mock);
      await readProjectConfig(workspaceRoot, project); 
    });
    
    afterEach(()=>{
      jest.restoreAllMocks();
    });

    it("should read the config from .project.json in the main worktree", () => {
      expect(fs.readFile).toHaveBeenCalledWith(mainProjectConfigPath, "utf-8");
    });
  });

  describe('the resolveProjectConfig function', () => {
    const projectConfig = {
      name: project,
      idea: "test idea",
      time: [],
      billing: { roundTo: "quarter-hour", rate: 150 }
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return config when it exists on main', async () => {
      (fs.readFile as jest.Mock).mockImplementation((p: string) =>
        p === mainProjectConfigPath ? Promise.resolve(JSON.stringify(projectConfig)) : Promise.reject(new Error("not found"))
      );

      const result = await resolveProjectConfig(workspaceRoot, project);
      expect(result).not.toBeNull();
      expect(result!.config.name).toBe(project);
      expect(result!.sourcePath).toBe(mainProjectConfigPath);
    });

    it('should return null when no config exists', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("not found"));

      const result = await resolveProjectConfig(workspaceRoot, project);
      expect(result).toBeNull();
    });
  });

  describe('the writeProjectConfig function', () => {
    beforeEach(async () => {
      (fs.writeFile as jest.Mock);
      await writeProjectConfig(workspaceRoot, project, baseGrindConfig);
    });
    
    afterEach(()=>{
      jest.restoreAllMocks();
    });

    it("should write the passed config to .project.json in the main worktree", () => {
      expect(fs.writeFile).toHaveBeenCalledWith(mainProjectConfigPath, JSON.stringify(baseGrindConfig, null, 2), "utf-8");
    });
  });
});
