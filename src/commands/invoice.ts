import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PassThrough } from "stream";
import { requireWorkspace } from "../utils/workspace.js";
import { readGrindConfig } from "../utils/config.js";
import { fileExists } from "../utils/files.js";
import { gitCommit } from "../utils/git.js";
import type { ProjectConfig, GrindConfig } from "../types/index.js";
import PDFDocument from "pdfkit";

/**
 * Generate invoice for a project
 * grind invoice <project-name>
 */
export async function invoiceProject(projectName: string): Promise<void> {
  console.log(`Generating invoice for project '${projectName}'...`);
  
  // 1. Find workspace root
  const { workspaceRoot, mainWorktree } = await requireWorkspace();
  
  // 2. Load workspace config for professional info
  const grindConfig = await readGrindConfig(mainWorktree);

  // 3. Determine where to read .project.json from (ONE location only!)
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

  if (await fileExists(projectWorktreeConfigPath)) {
    configPath = projectWorktreeConfigPath;
    console.log(`Reading config from project worktree...`);
  } else if (await fileExists(mainWorktreeConfigPath)) {
    configPath = mainWorktreeConfigPath;
    console.log(`Reading config from main worktree (project worktree not found)...`);
  } else {
    console.error(`Error: Project '${projectName}' not found.`);
    process.exit(1);
  }
  
  // 4. Load project config
  const configContent = await readFile(configPath, "utf-8");
  const config: ProjectConfig = JSON.parse(configContent);

  // 5. Filter sessions: only unbilled sessions with start AND end times
  const unbilledSessions = config.time.filter(
    s => s.end !== null && s.invoiced !== true
  );
  
  if (unbilledSessions.length === 0) {
    console.log("No unbilled sessions found.");
    process.exit(0);
  }
  
  console.log(`\nFound ${unbilledSessions.length} unbilled session(s):`);
  
  // 6. Calculate totals - group by date for the table
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
  
  // 7. Generate markdown invoice (in memory)
  const now = new Date();
  const invoiceDate = now.toISOString().split('T')[0];
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // 2026-01-27T14-30-15
  const paymentTerms = grindConfig.paymentTerms ?? "Net 30";
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days from now
  const currency = grindConfig.currency ?? "USD";
  const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;

  // Build FROM block from professional info
  const prof = grindConfig.my;
  const fromLines: string[] = [];
  if (prof?.company) fromLines.push(prof.company);
  if (prof?.name) fromLines.push(prof.name);
  if (prof?.address) fromLines.push(prof.address);
  if (prof?.phone) fromLines.push(prof.phone);
  if (prof?.email) fromLines.push(prof.email);
  if (prof?.taxId) fromLines.push(`Tax ID: ${prof.taxId}`);
  const fromBlock = fromLines.length > 0 ? fromLines.join('\n') : '(not configured — run grind config -g my.company "Your Company")';

  // Build TO block from client info
  const client = config.client;
  const toLines: string[] = [];
  if (client?.company) toLines.push(client.company);
  if (client?.contact) toLines.push(client.contact);
  if (client?.address) toLines.push(client.address);
  if (client?.phone) toLines.push(client.phone);
  if (client?.email) toLines.push(client.email);
  const toBlock = toLines.length > 0 ? toLines.join('\n') : '(not configured — run grind config client.company "Client Name")';

  // Build table rows
  const tableRows = Array.from(sessionsByDate.entries())
    .map(([date, data]) => {
      return `| ${date} | ${data.hours.toFixed(2)} | ${currencySymbol}${config.billing.rate.toFixed(2)} | ${currencySymbol}${data.amount.toFixed(2)} |`;
    })
    .join('\n');

  // Truncate idea for description (first 100 chars or first line)
  const description = config.idea.split('\n')[0].substring(0, 100);

  const invoiceMarkdown = `# INVOICE

**Invoice Date**: ${invoiceDate}
**Invoice ID**: ${timestamp}

---

## FROM
${fromBlock}

## TO
${toBlock}

---

## PROJECT
**Name**: ${projectName}
**Description**: ${description}

---

## TIME BREAKDOWN

| Date | Hours | Rate | Amount |
|------|-------|------|--------|
${tableRows}

**Subtotal**: ${currencySymbol}${subtotal.toFixed(2)}
**Total**: ${currencySymbol}${subtotal.toFixed(2)}

---

**Payment Terms**: ${paymentTerms}
**Due Date**: ${dueDate}
`;

  // 8. Generate PDF to buffer (in memory) - do this BEFORE writing anything
  console.log(`\nGenerating invoice...`);
  const pdfBuffer = await generateInvoicePDFBuffer({
    invoiceDate,
    invoiceId: timestamp,
    projectName,
    description,
    sessionsByDate,
    rate: config.billing.rate,
    currencySymbol,
    subtotal,
    paymentTerms,
    dueDate,
    fromBlock,
    toBlock,
  });

  // 9. All content generated successfully - now write everything atomically
  const invoiceDir = path.join(
    mainWorktree,
    "projects",
    projectName,
    "invoices",
    timestamp
  );
  const markdownPath = path.join(invoiceDir, "invoice.md");
  const pdfPath = path.join(invoiceDir, "invoice.pdf");

  await mkdir(invoiceDir, { recursive: true });
  await writeFile(markdownPath, invoiceMarkdown, "utf-8");
  await writeFile(pdfPath, pdfBuffer);

  // 10. Mark sessions as invoiced (in memory)
  for (const session of config.time) {
    if (session.end !== null && session.invoiced !== true) {
      session.invoiced = true;
    }
  }

  // 11. Save updated config - this is the final "commit"
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

  // 12. Commit changes to the project worktree
  await gitCommit(projectWorktreePath, `Invoice ${timestamp} for ${projectName}`);

  console.log(`\nInvoice generated:`);
  console.log(`  Markdown: ${markdownPath}`);
  console.log(`  PDF: ${pdfPath}`);
  console.log(`\nMarked ${unbilledSessions.length} session(s) as invoiced.`);
}

/**
 * Generate PDF invoice to a buffer (for atomic writes)
 */
async function generateInvoicePDFBuffer(
  data: {
    invoiceDate: string;
    invoiceId: string;
    projectName: string;
    description: string;
    sessionsByDate: Map<string, { hours: number; amount: number }>;
    rate: number;
    currencySymbol: string;
    subtotal: number;
    paymentTerms: string;
    dueDate: string;
    fromBlock: string;
    toBlock: string;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      const passThrough = new PassThrough();

      passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passThrough.on('end', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', reject);

      doc.pipe(passThrough);

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
      for (const line of data.fromBlock.split('\n')) {
        doc.text(line);
      }
      doc.moveDown();

      // TO section
      doc.fontSize(12).text('TO', { underline: true });
      doc.fontSize(10);
      for (const line of data.toBlock.split('\n')) {
        doc.text(line);
      }
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
        doc.text(`${data.currencySymbol}${data.rate.toFixed(2)}`, col3, y);
        doc.text(`${data.currencySymbol}${info.amount.toFixed(2)}`, col4, y);
        y += 20;
      }

      // Totals
      doc.moveDown(2);
      doc.font('Helvetica-Bold');
      doc.text(`Subtotal: ${data.currencySymbol}${data.subtotal.toFixed(2)}`, col3);
      doc.text(`Total: ${data.currencySymbol}${data.subtotal.toFixed(2)}`, col3);

      // Footer
      doc.moveDown(3);
      doc.font('Helvetica');
      doc.text(`Payment Terms: ${data.paymentTerms}`);
      doc.text(`Due Date: ${data.dueDate}`);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
