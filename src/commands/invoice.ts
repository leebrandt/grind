import path from "path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "fs";
import { getWorkspaceRoot, findMainWorktree } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import type { ProjectConfig } from "../types/index.js";
import PDFDocument from "pdfkit";

/**
 * Generate invoice for a project
 * grind invoice <project-name>
 */
export async function invoiceProject(projectName: string): Promise<void> {
  console.log(`Generating invoice for project '${projectName}'...`);
  
  // 1. Find workspace root
  const workspaceRoot = await getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }
  
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Error: Could not find main worktree.");
    process.exit(1);
  }
  
  // 2. Determine where to read .project.json from (ONE location only!)
  const projectWorktreePath = path.join(workspaceRoot, projectName);
  const projectWorktreeConfigPath = path.join(
    projectWorktreePath,
    "projects",
    projectName,
    ".project.json"
  );
  
  const mainWorktreeConfigPath = path.join(
    mainWorktree,
    "projects",
    projectName,
    ".project.json"
  );
  
  let configPath: string;
  let configLocation: 'project' | 'main';
  
  if (await fileExists(projectWorktreeConfigPath)) {
    configPath = projectWorktreeConfigPath;
    configLocation = 'project';
    console.log(`Reading config from project worktree...`);
  } else if (await fileExists(mainWorktreeConfigPath)) {
    configPath = mainWorktreeConfigPath;
    configLocation = 'main';
    console.log(`Reading config from main worktree (project worktree not found)...`);
  } else {
    console.error(`Error: Project '${projectName}' not found.`);
    process.exit(1);
  }
  
  // 3. Load project config
  const configContent = await readFile(configPath, "utf-8");
  const config: ProjectConfig = JSON.parse(configContent);
  
  // 4. Filter sessions: only unbilled sessions with start AND end times
  const unbilledSessions = config.time.filter(
    s => s.end !== null && s.invoiced !== true
  );
  
  if (unbilledSessions.length === 0) {
    console.log("No unbilled sessions found.");
    process.exit(0);
  }
  
  console.log(`\nFound ${unbilledSessions.length} unbilled session(s):`);
  
  // 5. Calculate totals - group by date for the table
  const sessionsByDate = new Map<string, { hours: number; amount: number }>();
  
  for (const session of unbilledSessions) {
    const date = new Date(session.start).toISOString().split('T')[0];
    const hours = session.rounded / 3600; // Convert seconds to hours
    const amount = hours * config.billing.rate;
    
    const existing = sessionsByDate.get(date) || { hours: 0, amount: 0 };
    sessionsByDate.set(date, {
      hours: existing.hours + hours,
      amount: existing.amount + amount
    });
  }
  
  // Display summary
  for (const [date, data] of sessionsByDate) {
    console.log(`  - ${date}: ${data.hours.toFixed(2)} hours`);
  }
  
  const subtotal = Array.from(sessionsByDate.values())
    .reduce((sum, day) => sum + day.amount, 0);
  const totalHours = Array.from(sessionsByDate.values())
    .reduce((sum, day) => sum + day.hours, 0);
  
  console.log(`\nTotal: ${totalHours.toFixed(2)} hours @ $${config.billing.rate.toFixed(2)}/hr = $${subtotal.toFixed(2)}`);
  
  // 6. Generate markdown invoice
  const now = new Date();
  const invoiceDate = now.toISOString().split('T')[0];
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // 2026-01-27T14-30-15
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days from now
  
  // Build table rows
  const tableRows = Array.from(sessionsByDate.entries())
    .map(([date, data]) => {
      return `| ${date} | ${data.hours.toFixed(2)} | $${config.billing.rate.toFixed(2)} | $${data.amount.toFixed(2)} |`;
    })
    .join('\n');
  
  // Truncate idea for description (first 100 chars or first line)
  const description = config.idea.split('\n')[0].substring(0, 100);
  
  const invoiceMarkdown = `# INVOICE

**Invoice Date**: ${invoiceDate}  
**Invoice ID**: ${timestamp}

---

## FROM
GarageMahal Studios  
6625 N London Dr  
Kansas City, MO 65141

## TO
Lee Brandt  
6625 N London Dr  
Kansas City, MO 65141

---

## PROJECT
**Name**: ${projectName}  
**Description**: ${description}

---

## TIME BREAKDOWN

| Date | Hours | Rate | Amount |
|------|-------|------|--------|
${tableRows}

**Subtotal**: $${subtotal.toFixed(2)}  
**Total**: $${subtotal.toFixed(2)}

---

**Payment Terms**: Net 30  
**Due Date**: ${dueDate}
`;
  
  // 7. Create invoices/<timestamp>/ directory in main worktree
  const invoiceDir = path.join(
    mainWorktree,
    "projects",
    projectName,
    "invoices",
    timestamp
  );
  await mkdir(invoiceDir, { recursive: true });
  
  // 8. Save markdown file
  const markdownPath = path.join(invoiceDir, "invoice.md");
  await writeFile(markdownPath, invoiceMarkdown, "utf-8");
  
  // 9. Generate PDF directly using pdfkit
  const pdfPath = path.join(invoiceDir, "invoice.pdf");
  await generateInvoicePDF(pdfPath, {
    invoiceDate,
    invoiceId: timestamp,
    projectName,
    description,
    sessionsByDate,
    rate: config.billing.rate,
    subtotal,
    dueDate
  });
  
  console.log(`\nInvoice generated:`);
  console.log(`  Markdown: ${markdownPath}`);
  console.log(`  PDF: ${pdfPath}`);
  
  // 10. Mark sessions as invoiced
  for (const session of config.time) {
    if (session.end !== null && session.invoiced !== true) {
      session.invoiced = true;
    }
  }
  
  // 11. Save updated config back to the SAME location we read from
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`\nMarked ${unbilledSessions.length} session(s) as invoiced.`);
}

/**
 * Generate PDF invoice using pdfkit
 */
async function generateInvoicePDF(
  outputPath: string,
  data: {
    invoiceDate: string;
    invoiceId: string;
    projectName: string;
    description: string;
    sessionsByDate: Map<string, { hours: number; amount: number }>;
    rate: number;
    subtotal: number;
    dueDate: string;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = createWriteStream(outputPath);
      
      doc.pipe(stream);
      
      // Header
      doc.fontSize(24).text('INVOICE', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(10);
      doc.text(`Invoice Date: ${data.invoiceDate}`);
      doc.text(`Invoice ID: ${data.invoiceId}`);
      doc.moveDown(2);
      
      // FROM section
      doc.fontSize(12).text('FROM', { underline: true });
      doc.fontSize(10);
      doc.text('GarageMahal Studios');
      doc.text('6625 N London Dr');
      doc.text('Kansas City, MO 65141');
      doc.moveDown();
      
      // TO section
      doc.fontSize(12).text('TO', { underline: true });
      doc.fontSize(10);
      doc.text('Lee Brandt');
      doc.text('6625 N London Dr');
      doc.text('Kansas City, MO 65141');
      doc.moveDown(2);
      
      // PROJECT section
      doc.fontSize(12).text('PROJECT', { underline: true });
      doc.fontSize(10);
      doc.text(`Name: ${data.projectName}`);
      doc.text(`Description: ${data.description}`);
      doc.moveDown(2);
      
      // TIME BREAKDOWN section
      doc.fontSize(12).text('TIME BREAKDOWN', { underline: true });
      doc.moveDown(0.5);
      
      // Table header
      const tableTop = doc.y;
      const col1 = 50;  // Date
      const col2 = 150; // Hours
      const col3 = 250; // Rate
      const col4 = 350; // Amount
      
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Date', col1, tableTop);
      doc.text('Hours', col2, tableTop);
      doc.text('Rate', col3, tableTop);
      doc.text('Amount', col4, tableTop);
      
      // Draw line under header
      doc.moveTo(col1, tableTop + 15)
         .lineTo(450, tableTop + 15)
         .stroke();
      
      // Table rows
      doc.font('Helvetica');
      let y = tableTop + 25;
      
      for (const [date, info] of data.sessionsByDate) {
        doc.text(date, col1, y);
        doc.text(info.hours.toFixed(2), col2, y);
        doc.text(`$${data.rate.toFixed(2)}`, col3, y);
        doc.text(`$${info.amount.toFixed(2)}`, col4, y);
        y += 20;
      }
      
      // Totals
      doc.moveDown(2);
      doc.font('Helvetica-Bold');
      doc.text(`Subtotal: $${data.subtotal.toFixed(2)}`, col3);
      doc.text(`Total: $${data.subtotal.toFixed(2)}`, col3);
      
      // Footer
      doc.moveDown(3);
      doc.font('Helvetica');
      doc.text('Payment Terms: Net 30');
      doc.text(`Due Date: ${data.dueDate}`);
      
      doc.end();
      
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
