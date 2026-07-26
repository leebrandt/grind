// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { DIM, RESET } from "./colors.js";

export interface ColumnDef {
  label: string;
  align?: "left" | "right";
}

interface Column {
  label: string;
  align: "left" | "right";
  width: number;
}

export interface CellDef {
  text: string;
  color?: string;
}

export class Table {
  private columns: Column[];

  constructor(defs: ColumnDef[], rows: string[][]) {
    this.columns = defs.map((def, i) => ({
      label: def.label,
      align: def.align ?? "left",
      width: Math.max(def.label.length, ...rows.map(row => (row[i] ?? "").length)),
    }));
  }

  printHeader(): void {
    const header = "  " + this.columns.map(col =>
      col.align === "right"
        ? col.label.padStart(col.width)
        : col.label.padEnd(col.width),
    ).join("  ");
    const divider = "  " + this.columns.map(col =>
      "─".repeat(col.width),
    ).join("  ");
    console.log(`${DIM}${header}${RESET}`);
    console.log(`${DIM}${divider}${RESET}`);
  }

  row(cells: CellDef[]): string {
    return "  " + cells.map((cell, i) => {
      const col = this.columns[i];
      const padded = col.align === "right"
        ? cell.text.padStart(col.width)
        : cell.text.padEnd(col.width);
      return cell.color ? `${cell.color}${padded}${RESET}` : padded;
    }).join("  ");
  }

  printRow(cells: CellDef[]): void {
    console.log(this.row(cells));
  }
}
