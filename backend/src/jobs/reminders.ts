import cron from 'node-cron';
import pool from '../config/database';

// Mark sent → late when 30+ days past sent_at; reminders for late invoices
export function startReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    console.log('Running late invoice check...');
    try {
      await pool.query(
        `UPDATE invoices SET status = 'late', updated_at = NOW()
         WHERE status = 'sent'
           AND sent_at IS NOT NULL
           AND sent_at < NOW() - INTERVAL '30 days'`
      );

      const result = await pool.query(
        `SELECT i.id, i.invoice_number, i.total, i.due_date, c.name as client_name, c.email as client_email
         FROM invoices i
         JOIN clients c ON i.client_id = c.id
         WHERE i.status = 'late'
         AND i.id NOT IN (
           SELECT invoice_id FROM payment_reminders
           WHERE sent_at > NOW() - INTERVAL '3 days'
         )`
      );

      for (const invoice of result.rows) {
        await pool.query('INSERT INTO payment_reminders (invoice_id, reminder_type) VALUES ($1, $2)', [
          invoice.id,
          'late',
        ]);
        console.log(`Reminder logged for invoice ${invoice.invoice_number} to ${invoice.client_email}`);
      }
    } catch (err) {
      console.error('Reminder job error:', err);
    }
  });
}

// Check for recurring invoices daily at midnight
export function startRecurrenceJob() {
  cron.schedule('0 0 * * *', async () => {
    console.log('Running recurring invoice check...');
    try {
      const result = await pool.query(
        `SELECT * FROM invoices
         WHERE is_recurring = true AND next_recurrence_date <= CURRENT_DATE AND status != 'draft'`
      );

      for (const invoice of result.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Get items from the original invoice
          const items = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order', [
            invoice.id,
          ]);

          // Generate new invoice number
          const numResult = await client.query(
            "SELECT invoice_number FROM invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
            [invoice.user_id]
          );
          const lastNum = parseInt(numResult.rows[0].invoice_number.replace('INV-', '')) + 1;
          const newNumber = `INV-${lastNum.toString().padStart(4, '0')}`;

          // Calculate new dates
          const intervalMap: Record<string, string> = {
            weekly: '7 days',
            monthly: '1 month',
            quarterly: '3 months',
            yearly: '1 year',
          };
          const interval = intervalMap[invoice.recurrence_interval] || '1 month';

          const newInvoice = await client.query(
            `INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, subtotal, tax_rate, tax_amount, discount_amount, total, notes, is_recurring, recurrence_interval, next_recurrence_date)
             VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '${interval}', $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE + INTERVAL '${interval}' + INTERVAL '${interval}')
             RETURNING id`,
            [
              invoice.user_id,
              invoice.client_id,
              newNumber,
              invoice.subtotal,
              invoice.tax_rate,
              invoice.tax_amount,
              invoice.discount_amount,
              invoice.total,
              invoice.notes,
              true,
              invoice.recurrence_interval,
            ]
          );

          // Copy items
          for (const item of items.rows) {
            await client.query(
              'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
              [newInvoice.rows[0].id, item.description, item.quantity, item.unit_price, item.amount, item.sort_order]
            );
          }

          // Update original invoice's next recurrence date
          await client.query(
            `UPDATE invoices SET next_recurrence_date = CURRENT_DATE + INTERVAL '${interval}' WHERE id = $1`,
            [invoice.id]
          );

          await client.query('COMMIT');
          console.log(`Created recurring invoice ${newNumber} from ${invoice.invoice_number}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Error creating recurring invoice from ${invoice.invoice_number}:`, err);
        } finally {
          client.release();
        }
      }
    } catch (err) {
      console.error('Recurrence job error:', err);
    }
  });
}
