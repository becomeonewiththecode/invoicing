import { create } from 'zustand';

export interface PortalSession {
  client: { id: string; name: string; email: string; company?: string | null };
  vendor: { businessName?: string | null };
  portal: { twoFactorEnabled: boolean };
}

function readToken() {
  return localStorage.getItem('portalToken');
}

function readSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem('portalSession');
    if (!raw) return null;
    return JSON.parse(raw) as PortalSession;
  } catch {
    return null;
  }
}

interface PortalAuthState {
  token: string | null;
  session: PortalSession | null;
  setPortalAuth: (token: string, session: PortalSession) => void;
  logout: () => void;
  syncFromStorage: () => void;
}

export const usePortalAuthStore = create<PortalAuthState>((set) => ({
  token: readToken(),
  session: readSession(),
  setPortalAuth: (token, session) => {
    localStorage.setItem('portalToken', token);
    localStorage.setItem('portalSession', JSON.stringify(session));
    set({ token, session });
  },
  logout: () => {
    localStorage.removeItem('portalToken');
    localStorage.removeItem('portalSession');
    set({ token: null, session: null });
  },
  syncFromStorage: () => set({ token: readToken(), session: readSession() }),
}));
