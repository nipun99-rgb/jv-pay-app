/**
 * G703 Extractor — Node.js wrapper for extract_g703.py
 * Invokes the Python script, parses the CSV output, and loads data into Azure SQL.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const prisma = require('../prisma');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const PYTHON = process.env.PYTHON_PATH || 'python';

async function extractG703(pdfLocalPath, packageId) {
  const outCsv = path.join(UPLOAD_DIR, `g703_${packageId}.csv`);

  // Run Python extractor
  await new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [
      path.join(__dirname, '../../extract_g703.py'),
      pdfLocalPath,
      outCsv
    ]);

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`G703 extractor exited with code ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });

  // Parse CSV and load into database
  const csvContent = fs.readFileSync(outCsv, 'utf-8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  // Bulk insert SOV lines
  for (const row of records) {
    await prisma.gcPayApplicationSovLine.create({
      data: {
        packageId,
        itemNo: row['Item No.'] || null,
        timePeriod: row['Time Period'] || null,
        phases: row['Phases'] || null,
        typeOfWork: row['Type of work'] || null,
        contractorName: row['Contractor name'] || null,
        scheduledOriginal: parseFloat(row['SCHEDULED ORIGINAL']) || 0,
        scheduledChangeOrders: parseFloat(row['SCHEDULED CHANGE ORDERS']) || 0,
        scheduledCurrent: parseFloat(row['SCHEDULED CURRENT']) || 0,
        workCompletedPrev: parseFloat(row['WORK COMPLETED FROM PREVIOUS APPLICATION']) || 0,
        workCompletedThis: parseFloat(row['WORK COMPLETED THIS PERIOD']) || 0,
        materialsStored: parseFloat(row['MATERIALS PRESENTLY STORED']) || 0,
        totalCompleted: parseFloat(row['TOTAL COMPLETED AND STORED']) || 0,
        pct: parseFloat(row['% (G / C)']) || 0,
        balanceToFinish: parseFloat(row['Balance to Finish (C-G)']) || 0,
        retainage: parseFloat(row['RETAINAGE (If Variable Rate)']) || 0,
        sourcePage: parseInt(row['Source Page']) || null,
        validationStatus: 'unchecked'
      }
    });
  }

  // Clean up CSV
  fs.unlink(outCsv, () => {});

  return records.length;
}

module.exports = { extractG703 };
