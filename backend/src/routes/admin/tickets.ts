import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ticketQuerySchema, ticketReplySchema, ticketStatusSchema } from '../../models/adminValidation';
import { getTickets, getTicketDetail, replyToTicket, updateTicketStatus } from '../../services/adminTickets';

const router = Router();

router.get('/', validate(ticketQuerySchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, status, priority, search } = req.validatedQuery as {
      page: number;
      limit: number;
      status?: string;
      priority?: string;
      search?: string;
    };
    const result = await getTickets(page, limit, { status, priority, search });
    res.json(result);
  } catch (err) {
    console.error('Admin list tickets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await getTicketDetail(String(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    console.error('Admin ticket detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reply', validate(ticketReplySchema), async (req: AuthRequest, res: Response) => {
  try {
    const message = await replyToTicket(String(req.params.id), req.userId!, req.body.body, true);
    res.status(201).json(message);
  } catch (err) {
    console.error('Admin ticket reply error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/status', validate(ticketStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await updateTicketStatus(String(req.params.id), req.body.status);
    if (!result) return res.status(404).json({ error: 'Ticket not found' });
    res.json(result);
  } catch (err) {
    console.error('Admin ticket status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
