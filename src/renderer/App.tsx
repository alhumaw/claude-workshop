import React, { useEffect, useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { NewSessionModal } from './components/NewSessionModal';
import { CreateTeamModal } from './components/CreateTeamModal';
import { useSessionStore } from './stores/session-store';

declare global {
  interface Window {
    electronAPI: {
      spawnSession: (name: string, cwd?: string, avatarSeed?: string, model?: string) => Promise<any>;
      killSession: (sessionId: string) => Promise<any>;
      listSessions: () => Promise<any[]>;
      getSessionBuffer: (sessionId: string) => Promise<string>;
      writeToTerminal: (sessionId: string, data: string) => void;
      onTerminalData: (callback: (sessionId: string, data: string) => void) => () => void;
      resizeTerminal: (sessionId: string, cols: number, rows: number) => void;
      showSessionContextMenu: (sessionId: string) => void;
      onContextMenuAction: (callback: (sessionId: string, action: string) => void) => () => void;
      onStatusUpdate: (callback: (sessions: any[]) => void) => () => void;
      loadToolkit: (cwd: string) => Promise<any>;
      executeToolkitAction: (sessionId: string, command: string) => Promise<any>;
      handoffSession: (sessionId: string) => Promise<{ newSessionId: string; handoffText: string; sessionInfo: any }>;
      freshSession: (sessionId: string) => Promise<any>;
      onTerminalTextRequest: (callback: (sessionId: string) => string) => () => void;
      onShortcut: (channel: string, callback: (...args: any[]) => void) => () => void;
      onSessionRestored: (callback: (session: any) => void) => () => void;
      validateDirectory: (path: string) => Promise<boolean>;
      getConfig: () => Promise<any>;
      setConfig: (config: any) => Promise<{ ok: boolean; error?: string }>;
      openFolderDialog: () => Promise<string | null>;
      openFileDialog: () => Promise<string | null>;
      exportToObsidian: (projectDir: string) => Promise<{ ok: boolean; outDir?: string; error?: string }>;
      createTeam: (params: { teamName: string; description: string; leadConfig: any; teammateConfigs: any[] }) => Promise<{ teamName: string; team: any; members: any[] }>;
      addTeamMember: (params: { teamName: string; memberConfig: any }) => Promise<any>;
      deleteTeam: (teamName: string) => Promise<{ ok: boolean }>;
      listTeams: () => Promise<any[]>;
      scanRoles: () => Promise<Array<{ name: string; promptPath: string }>>;
      saveTeamTemplate: (template: any) => Promise<{ ok: boolean }>;
      loadTeamTemplates: () => Promise<any[]>;
      deleteTeamTemplate: (templateId: string) => Promise<{ ok: boolean }>;
      onTeamRestored: (callback: (team: any) => void) => () => void;
    };
  }
}

export default function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const updateSessions = useSessionStore((s) => s.updateFromStatus);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActive = useSessionStore((s) => s.setActiveSession);
  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const addTeam = useSessionStore((s) => s.addTeam);

  // Status polling
  useEffect(() => {
    return window.electronAPI.onStatusUpdate((sessions) => {
      updateSessions(sessions);
    });
  }, [updateSessions]);

  // Create session handler
  const handleCreate = useCallback(async (name: string, cwd?: string, avatarSeed?: string, model?: string) => {
    const info = await window.electronAPI.spawnSession(name, cwd, avatarSeed, model);
    addSession(info);
  }, [addSession]);

  // Close active session handler
  const handleCloseActive = useCallback(async () => {
    if (activeSessionId) {
      await window.electronAPI.killSession(activeSessionId);
      removeSession(activeSessionId);
    }
  }, [activeSessionId, removeSession]);

  // Keyboard shortcuts from main process
  useEffect(() => {
    const unsubs = [
      window.electronAPI.onShortcut('shortcut:new-session', () => {
        setModalOpen(true);
      }),
      window.electronAPI.onShortcut('shortcut:close-session', () => {
        handleCloseActive();
      }),
      window.electronAPI.onShortcut('shortcut:switch-session', (index: number) => {
        const s = useSessionStore.getState().sessions;
        if (index < s.length) {
          setActive(s[index].id);
        }
      }),
      window.electronAPI.onShortcut('shortcut:prev-session', () => {
        const state = useSessionStore.getState();
        const idx = state.sessions.findIndex((s) => s.id === state.activeSessionId);
        if (idx > 0) setActive(state.sessions[idx - 1].id);
      }),
      window.electronAPI.onShortcut('shortcut:next-session', () => {
        const state = useSessionStore.getState();
        const idx = state.sessions.findIndex((s) => s.id === state.activeSessionId);
        if (idx < state.sessions.length - 1) setActive(state.sessions[idx + 1].id);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [handleCloseActive, setActive]);

  // Handle restored sessions from persistence
  useEffect(() => {
    return window.electronAPI.onSessionRestored((session) => {
      addSession(session);
    });
  }, [addSession]);

  // Handle restored teams from persistence
  useEffect(() => {
    return window.electronAPI.onTeamRestored((team) => {
      addTeam(team);
    });
  }, [addTeam]);

  return (
    <>
      <Layout onNewSession={() => setModalOpen(true)} onNewTeam={() => setTeamModalOpen(true)} />
      <NewSessionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
      <CreateTeamModal
        isOpen={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
      />
    </>
  );
}
