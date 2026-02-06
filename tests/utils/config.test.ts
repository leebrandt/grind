import * as fs from "node:fs/promises";
import path from "node:path";  
import { readGrindConfig, writeGrindConfig, readProjectConfig, writeProjectConfig } from "../../src/utils/config.ts";

jest.mock("node:fs/promises");

describe('grind config utilities', () => {
  const rootPath = "/home/user/grind";
  const project = "my-project";
  const projectConfigPath = path.join(rootPath, project, "projects", project, ".project.json");
  const configPath = path.join(rootPath, ".grind.json");
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
        result = await readGrindConfig(rootPath);
      });
    
      afterEach(()=>{
        jest.restoreAllMocks();
      });

      it('should read the .grind.config file in the main workspace', async () => {
        expect(fs.readFile).toHaveBeenCalledWith(configPath, "utf-8");
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
          await expect(readGrindConfig(rootPath)).rejects.toThrow("TEST FAILURE");
      });
    });
  });

  describe('the readProjectConfig function', () => {
    const project = "my-project";
    const projectConfigPath = path.join(rootPath, project, "projects", project, ".project.json");

    beforeEach(async () => {
      (fs.readFile as jest.Mock);
      await readProjectConfig(rootPath, project); 
    });
    
    afterEach(()=>{
      jest.restoreAllMocks();
    });

    it("should read the config from .project.json in the project workspace", () => {
      expect(fs.readFile).toHaveBeenCalledWith(projectConfigPath, "utf-8");
    });
  });

  describe('the writeProjectConfig function', () => {
    beforeEach(async () => {
      (fs.writeFile as jest.Mock);
      await writeProjectConfig(rootPath, project, baseGrindConfig);
    });
    
    afterEach(()=>{
      jest.restoreAllMocks();
    });

    it("should write the passed config to .project.json in the project workspace", () => {
      expect(fs.writeFile).toHaveBeenCalledWith(projectConfigPath, JSON.stringify(baseGrindConfig, null, 2), "utf-8");
    });
  });
});
