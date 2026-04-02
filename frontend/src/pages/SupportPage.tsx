import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { submitTicket, getMyTickets, getTicketDetail, replyToTicket } from '../api/tickets';

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-700',
};

export function SupportPage() {
  const [page, setPage] = useState(1);
  const [viewTicketId, setViewTicketId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', body: '', priority: 'normal' });
  const [reply, setReply] = useState('');
  const queryClient = useQueryClient();

  const { data: tickets } = useQuery({
    queryKey: ['my-tickets', page],
    queryFn: () => getMyTickets(page, 20),
  });

  const { data: ticketDetail } = useQuery({
    queryKey: ['my-ticket', viewTicketId],
    queryFn: () => getTicketDetail(viewTicketId!),
    enabled: !!viewTicketId,
  });

  const createMutation = useMutation({
    mutationFn: () => submitTicket(newTicket),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      setShowNewForm(false);
      setNewTicket({ subject: '', body: '', priority: 'normal' });
      toast.success('Ticket submitted');
    },
    onError: () => toast.error('Failed to submit ticket'),
  });

  const replyMutation = useMutation({
    mutationFn: () => replyToTicket(viewTicketId!, reply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-ticket', viewTicketId] });
      setReply('');
      toast.success('Reply sent');
    },
    onError: () => toast.error('Failed to send reply'),
  });

  if (viewTicketId && ticketDetail) {
    return (
      <div>
        <button
          onClick={() => setViewTicketId(null)}
          className="text-sm text-primary hover:text-primary-hover mb-4 inline-block"
        >
          &larr; Back to Tickets
        </button>

        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-text">{ticketDetail.subject}</h1>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticketDetail.status] || ''}`}>
            {ticketDetail.status.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-4 mb-6">
          {ticketDetail.messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-4 ${
                msg.is_admin_reply ? 'bg-primary-light border border-primary-light-border ml-8' : 'bg-surface border border-border mr-8'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text">
                  {msg.is_admin_reply ? 'Support Team' : 'You'}
                </span>
                <span className="text-xs text-text-muted">{new Date(msg.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{msg.body}</p>
            </div>
          ))}
        </div>

        {ticketDetail.status !== 'closed' && (
          <div className="bg-surface rounded-lg border border-border p-4">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply..."
              rows={4}
              className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-focus"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => replyMutation.mutate()}
                disabled={!reply.trim() || replyMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
              >
                Send Reply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Support</h1>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover"
        >
          New Ticket
        </button>
      </div>

      {showNewForm && (
        <div className="bg-surface rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Submit a Ticket</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Subject"
              value={newTicket.subject}
              onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              className="w-full rounded-lg border border-input-border px-4 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <textarea
              placeholder="Describe your issue..."
              value={newTicket.body}
              onChange={(e) => setNewTicket({ ...newTicket, body: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-input-border px-4 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <select
              value={newTicket.priority}
              onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
              className="rounded-lg border border-input-border px-3 py-2 text-sm"
            >
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newTicket.subject || !newTicket.body}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
              >
                Submit
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="rounded-lg border px-4 py-2 text-sm text-text-secondary hover:bg-surface-alt"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-alt">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tickets?.data.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-surface-alt cursor-pointer" onClick={() => setViewTicketId(ticket.id)}>
                <td className="px-6 py-4 text-sm text-primary">{ticket.subject}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticket.status] || ''}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary capitalize">{ticket.priority}</td>
                <td className="px-6 py-4 text-sm text-text-muted">{new Date(ticket.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {tickets && tickets.data.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-4 text-center text-text-muted">No tickets yet</td></tr>
            )}
          </tbody>
        </table>

        {tickets && tickets.pagination.total > tickets.pagination.limit && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-sm text-text-muted">Page {page} of {Math.ceil(tickets.pagination.total / tickets.pagination.limit)}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
              <button disabled={page >= Math.ceil(tickets.pagination.total / tickets.pagination.limit)} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
