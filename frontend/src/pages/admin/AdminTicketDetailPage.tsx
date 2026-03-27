import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getAdminTicketDetail, adminReplyToTicket, updateTicketStatus } from '../../api/admin';

export function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');

  const { data: ticket, isPending } = useQuery({
    queryKey: ['admin-ticket', id],
    queryFn: () => getAdminTicketDetail(id!),
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: () => adminReplyToTicket(id!, reply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket', id] });
      setReply('');
      toast.success('Reply sent');
    },
    onError: () => toast.error('Failed to send reply'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateTicketStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket', id] });
      toast.success('Status updated');
    },
  });

  if (isPending) return <div className="text-gray-500">Loading...</div>;
  if (!ticket) return <div className="text-gray-500">Ticket not found</div>;

  return (
    <div>
      <Link to="/admin/tickets" className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 inline-block">
        &larr; Back to Tickets
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
          <p className="text-sm text-gray-500 mt-1">
            From {ticket.user_email} &middot; {new Date(ticket.created_at).toLocaleString()}
          </p>
        </div>
        <select
          value={ticket.status}
          onChange={(e) => statusMutation.mutate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="space-y-4 mb-6">
        {ticket.messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-4 ${
              msg.is_admin_reply ? 'bg-indigo-50 border border-indigo-200 ml-8' : 'bg-white border border-gray-200 mr-8'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">
                {msg.is_admin_reply ? 'Admin' : msg.sender_email}
              </span>
              <span className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== 'closed' && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply..."
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => replyMutation.mutate()}
              disabled={!reply.trim() || replyMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Send Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
