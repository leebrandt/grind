// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { workStart } from "./work.js";

/**
 * Open code editor in project's code directory (no timer)
 * grind code <project>
 */
export async function openCode(projectName: string): Promise<void> {
  await workStart(projectName, { code: true, quiet: true });
}
