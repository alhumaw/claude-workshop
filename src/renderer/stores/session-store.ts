import { create } from 'zustand';
import { SessionInfo, TeamInfo } from '../../shared/types';

interface SessionStore {
  sessions: SessionInfo[];
  teams: TeamInfo[];
  activeSessionId: string | null;
  terminalDataCallbacks: Map<string, ((data: string) => void)[]>;

  setActiveSession: (id: string) => void;
  addSession: (session: SessionInfo) => void;
  removeSession: (id: string) => void;
  reorderSessions: (fromIndex: number, toIndex: number) => void;
  renameSession: (id: string, name: string) => void;
  updateAvatarSeed: (id: string, seed: string) => void;
  updateFromStatus: (sessions: SessionInfo[]) => void;
  registerTerminalCallback: (sessionId: string, cb: (data: string) => void) => () => void;
  getTerminalCallbacks: (sessionId: string) => ((data: string) => void)[];
  handoffSession: (sessionId: string) => Promise<void>;
  freshSession: (sessionId: string) => Promise<void>;

  // Team actions
  addTeam: (team: TeamInfo) => void;
  removeTeam: (teamId: string) => void;
  toggleTeamCollapsed: (teamId: string) => void;
  createTeam: (params: {
    teamName: string;
    description: string;
    leadConfig: any;
    teammateConfigs: any[];
  }) => Promise<void>;
  addTeamMember: (teamName: string, memberConfig: any) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  teams: [],
  activeSessionId: null,
  terminalDataCallbacks: new Map(),

  setActiveSession: (id) => set({ activeSessionId: id }),

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: state.activeSessionId ?? session.id,
    })),

  removeSession: (id) =>
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? sessions[0]?.id ?? null
          : state.activeSessionId;
      // Also remove from team memberSessionIds
      const teams = state.teams.map((t) => ({
        ...t,
        memberSessionIds: t.memberSessionIds.filter((sid) => sid !== id),
        leadSessionId: t.leadSessionId === id ? null : t.leadSessionId,
      }));
      return { sessions, activeSessionId, teams };
    }),

  reorderSessions: (fromIndex, toIndex) =>
    set((state) => {
      const sessions = [...state.sessions];
      const [moved] = sessions.splice(fromIndex, 1);
      sessions.splice(toIndex, 0, moved);
      return { sessions };
    }),

  renameSession: (id, name) => {
    window.electronAPI.renameSession(id, name);
    set((state) => ({
      sessions: state.sessions.map((s) => s.id === id ? { ...s, name } : s),
    }));
  },

  updateAvatarSeed: (id, seed) => {
    window.electronAPI.updateAvatarSeed(id, seed);
    set((state) => ({
      sessions: state.sessions.map((s) => s.id === id ? { ...s, avatarSeed: seed } : s),
    }));
  },

  updateFromStatus: (incoming) =>
    set((state) => {
      // Merge incoming status with existing sessions, preserving local fields
      const map = new Map(incoming.map((s) => [s.id, s]));
      const updated = state.sessions.map((s) => {
        const fresh = map.get(s.id);
        return fresh ? {
          ...fresh,
          name: s.name,
          avatarSeed: s.avatarSeed,
          teamId: s.teamId,
          teamRole: s.teamRole,
          teamAgentName: s.teamAgentName,
        } : s;
      });
      // Add any new sessions from status that we don't have yet
      for (const s of incoming) {
        if (!updated.find((u) => u.id === s.id)) {
          updated.push(s);
        }
      }
      return { sessions: updated };
    }),

  registerTerminalCallback: (sessionId, cb) => {
    const cbs = get().terminalDataCallbacks;
    if (!cbs.has(sessionId)) cbs.set(sessionId, []);
    cbs.get(sessionId)!.push(cb);
    set({ terminalDataCallbacks: new Map(cbs) });
    return () => {
      const arr = cbs.get(sessionId);
      if (arr) {
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  },

  getTerminalCallbacks: (sessionId) => {
    return get().terminalDataCallbacks.get(sessionId) ?? [];
  },

  handoffSession: async (sessionId) => {
    const result = await window.electronAPI.handoffSession(sessionId);
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== sessionId);
      return {
        sessions: [...sessions, result.sessionInfo],
        activeSessionId: result.sessionInfo.id,
      };
    });
  },

  freshSession: async (sessionId) => {
    const newSession = await window.electronAPI.freshSession(sessionId);
    set((state) => ({
      sessions: [...state.sessions, newSession],
      activeSessionId: newSession.id,
    }));
  },

  // ── Team actions ──────────────────────────────────────────────────

  addTeam: (team) =>
    set((state) => ({
      teams: [...state.teams, team],
    })),

  removeTeam: (teamId) =>
    set((state) => ({
      teams: state.teams.filter((t) => t.id !== teamId),
      sessions: state.sessions.map((s) =>
        s.teamId === teamId
          ? { ...s, teamId: undefined, teamRole: undefined, teamAgentName: undefined }
          : s
      ),
    })),

  toggleTeamCollapsed: (teamId) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, collapsed: !t.collapsed } : t
      ),
    })),

  createTeam: async (params) => {
    const result = await window.electronAPI.createTeam(params);
    set((state) => ({
      teams: [...state.teams, result.team],
      sessions: [...state.sessions, ...result.members],
      activeSessionId: result.members[0]?.id ?? state.activeSessionId,
    }));
  },

  addTeamMember: async (teamName, memberConfig) => {
    const newSession = await window.electronAPI.addTeamMember({ teamName, memberConfig });
    set((state) => ({
      sessions: [...state.sessions, newSession],
      teams: state.teams.map((t) =>
        t.id === teamName
          ? { ...t, memberSessionIds: [...t.memberSessionIds, newSession.id] }
          : t
      ),
      activeSessionId: newSession.id,
    }));
  },
}));
