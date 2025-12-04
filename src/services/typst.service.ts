import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { ContractJobData } from '../types.js';

const execAsync = promisify(exec);

export class TypstService {
  private templatePath: string;

  constructor() {
    // Path to the Typst template
    this.templatePath = join(process.cwd(), 'templates', 'rental-contract.typ');
  }

  private async fillTemplate(data: ContractJobData): Promise<string> {
    // Read the template
    const template = await readFile(this.templatePath, 'utf-8');

    // Format dates
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    // Replace all placeholders
    const filled = template
      .replace(/\{\{contractNumber\}\}/g, data.contractNumber)
      .replace(/\{\{city\}\}/g, data.city)
      .replace(/\{\{date\}\}/g, formatDate(data.startDate))
      .replace(/\{\{sellerName\}\}/g, data.sellerName)
      .replace(/\{\{sellerPhone\}\}/g, data.sellerPhone)
      .replace(/\{\{sellerKaspiPhone\}\}/g, data.sellerKaspiPhone)
      .replace(/\{\{clientName\}\}/g, data.clientName)
      .replace(/\{\{clientPhone\}\}/g, data.clientPhone)
      .replace(/\{\{productName\}\}/g, data.productName)
      .replace(/\{\{quantity\}\}/g, data.quantity.toString())
      .replace(/\{\{rentalPrice\}\}/g, data.rentalPrice.toLocaleString('ru-RU'))
      .replace(/\{\{period\}\}/g, data.period)
      .replace(/\{\{startDate\}\}/g, formatDate(data.startDate))
      .replace(/\{\{endDate\}\}/g, formatDate(data.endDate))
      .replace(/\{\{totalAmount\}\}/g, data.totalAmount.toLocaleString('ru-RU'))
      .replace(/\{\{contractId\}\}/g, data.contractId);

    return filled;
  }

  async generatePDF(data: ContractJobData): Promise<Buffer> {
    const tempTypFile = join(process.cwd(), 'temp', `contract-${data.contractId}.typ`);
    const tempPdfFile = join(process.cwd(), 'temp', `contract-${data.contractId}.pdf`);

    try {
      // Fill the template
      const filledTemplate = await this.fillTemplate(data);

      // Write the filled template to a temporary file
      await writeFile(tempTypFile, filledTemplate, 'utf-8');

      // Compile with Typst
      const { stderr } = await execAsync(`typst compile "${tempTypFile}" "${tempPdfFile}"`);

      if (stderr) {
        console.warn('Typst warnings:', stderr);
      }

      // Read the generated PDF
      const pdfBuffer = await readFile(tempPdfFile);

      // Clean up temporary files
      await unlink(tempTypFile);
      await unlink(tempPdfFile);

      return pdfBuffer;
    } catch (error) {
      // Clean up on error
      try {
        await unlink(tempTypFile);
      } catch {}
      try {
        await unlink(tempPdfFile);
      } catch {}

      throw error;
    }
  }
}
