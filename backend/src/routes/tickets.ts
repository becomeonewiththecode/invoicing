import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTicketSchema, ticketReplySchema, paginationSchema } from '../models/adminValidation';
import { createTicket, getUserTickets, getTicketDetail, replyToTicket } from '../services/adminTickets';

const router = Router();

router.use(authenticate);

router.post('/', validate(createTicketSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { subject, body, priority } = req.body;
    const ticket = await createTicket(req.userId!, subject, body, priority);
    res.status(201).json(ticket);
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', validate(paginationSchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = req.validatedQuery as { page: number; limit: number };
    const result = await getUserTickets(req.userId!, page, limit);
    res.json(result);
  } catch (err) {
    console.error('List tickets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await getTicketDetail(String(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    // Ensure user can only see their own tickets
    if (ticket.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(ticket);
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reply', validate(ticketReplySchema), async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await getTicketDetail(String(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const message = await replyToTicket(String(req.params.id), req.userId!, req.body.body, false);
    res.status(201).json(message);
  } catch (err) {
    console.error('Reply to ticket error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
