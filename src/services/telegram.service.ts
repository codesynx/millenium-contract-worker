import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config.js';

export class TelegramService {
  private bot: TelegramBot;

  constructor() {
    const token = config.telegram.botToken;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required for contract delivery');
    }

    // Initialize bot without polling (we only send messages)
    this.bot = new TelegramBot(token, { polling: false });
  }

  /**
   * Send contract PDF to a user via Telegram
   */
  async sendContractPDF(
    telegramId: string,
    pdfBuffer: Buffer,
    contractNumber: string,
    toolName: string,
    isClient: boolean
  ): Promise<void> {
    try {
      const fileName = `Договор_аренды_${contractNumber}.pdf`;

      const caption = isClient
        ? `📄 Договор аренды № ${contractNumber}\n\n🛠 Оборудование: ${toolName}\n\nДоговор вступает в силу после оплаты.`
        : `📄 Договор аренды № ${contractNumber}\n\n🛠 Оборудование: ${toolName}\n\nКлиент получил копию договора.`;

      await this.bot.sendDocument(
        telegramId,
        pdfBuffer,
        {
          caption,
        },
        {
          filename: fileName,
          contentType: 'application/pdf',
        }
      );

      console.log(`✓ Sent contract PDF to ${isClient ? 'client' : 'seller'} ${telegramId}`);
    } catch (error) {
      console.error(`✗ Failed to send contract PDF to ${telegramId}:`, error);
      throw error;
    }
  }

  /**
   * Send contract PDF to both client and seller
   */
  async sendContractToBothParties(
    clientTelegramId: string,
    sellerTelegramId: string,
    pdfBuffer: Buffer,
    contractNumber: string,
    toolName: string
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.sendContractPDF(clientTelegramId, pdfBuffer, contractNumber, toolName, true),
      this.sendContractPDF(sellerTelegramId, pdfBuffer, contractNumber, toolName, false),
    ]);

    // Check if any failed
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`⚠️  ${failures.length}/${results.length} contract deliveries failed`);
      failures.forEach((f, i) => {
        if (f.status === 'rejected') {
          console.error(`  Failure ${i + 1}:`, f.reason);
        }
      });
    } else {
      console.log(`✓ Contract ${contractNumber} sent to both parties successfully`);
    }
  }
}
