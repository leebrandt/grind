// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { status } from "./status.js";
import { listAllTasks } from "./tasks.js";
import { DIM, RESET } from "../utils/colors.js";

export async function wwd(): Promise<void> {
  await status();

  console.log();
  console.log(`${DIM} ${"─".repeat(27)} The GrindCLI ${"─".repeat(30)}${RESET}`);
  console.log();

  await listAllTasks({});
}
