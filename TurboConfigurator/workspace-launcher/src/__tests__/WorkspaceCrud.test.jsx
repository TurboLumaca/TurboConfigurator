import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useWorkspaceStore } from '../state/workspaceStore';
import {
  WORKSPACE_ACTION_TYPES,
  WORKSPACE_CATEGORIES,
  WORKSPACE_STORE_VERSION,
  createWorkspace,
  createWorkspaceAction,
} from '../domain/workspaceTypes';
import { APP_STATE_STORAGE_KEY } from '../services/persistenceStore';

function seedPersistedWorkspaces() {
  const workspaces = [
    createWorkspace({
      id: 'test-metodi-numerici',
      name: 'Metodi Numerici',
      description: 'Workspace test per metodi numerici',
      category: WORKSPACE_CATEGORIES.STUDY,
      actions: [
        createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
          name: 'Open study folder',
          folderPath: '~/Documents/Universita/MetodiNumerici',
        }),
      ],
    }),
    createWorkspace({
      id: 'test-aurea-dev',
      name: 'Aurea Dev Session',
      description: 'Workspace test per sessione coding',
      category: WORKSPACE_CATEGORIES.CODING,
      actions: [
        createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_VSCODE_PROJECT, {
          name: 'Open repo',
          projectPath: '~/Documents/Side hustle/TurboConfigurator/workspace-launcher',
        }),
      ],
    }),
  ];

  const snapshot = {
    version: WORKSPACE_STORE_VERSION,
    initialized: true,
    workspaces,
    preferences: {
      activeWorkspaceId: workspaces[0].id,
      autoLaunchOnLogin: false,
      continueOnError: false,
      defaultRunMode: 'sequential',
    },
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    APP_STATE_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      value: snapshot,
    }),
  );
}

describe('Workspace CRUD interactions', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    window.localStorage.clear();
    seedPersistedWorkspaces();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    window.confirm.mockRestore();
  });

  test('aggiunge una nuova configurazione e aggiorna la UI', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await screen.findByRole('button', { name: /metodi numerici/i });

    await user.click(screen.getByRole('button', { name: /new workspace/i }));

    await user.clear(screen.getByTestId('workspace-name-input'));
    await user.type(screen.getByTestId('workspace-name-input'), 'Nuova Configurazione Test');
    await user.clear(screen.getByTestId('workspace-description-input'));
    await user.type(screen.getByTestId('workspace-description-input'), 'Preset creato da test automatico');
    await user.clear(screen.getByTestId('workspace-path-input'));
    await user.type(screen.getByTestId('workspace-path-input'), '~/Documents/TestWorkspace');

    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => {
      const activeTitle = container.querySelector('.detail-hero__title')?.textContent || '';
      expect(activeTitle).toMatch(/nuova configurazione test/i);
    });
  });

  test('modifica configurazione esistente e aggiorna la UI', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await screen.findByRole('button', { name: /metodi numerici/i });

    await user.click(screen.getByRole('button', { name: /edit workspace/i }));

    const nameInput = screen.getByTestId('workspace-name-input');
    await user.clear(nameInput);
    await user.type(nameInput, 'Metodi Numerici Updated');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const activeTitle = container.querySelector('.detail-hero__title')?.textContent || '';
      expect(activeTitle).toMatch(/metodi numerici updated/i);
    });
  });

  test('elimina configurazione e rimuove item dalla lista', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await screen.findByRole('button', { name: /metodi numerici/i });

    await user.click(screen.getByRole('button', { name: /delete workspace/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /metodi numerici/i })).not.toBeInTheDocument();
      const activeTitle = container.querySelector('.detail-hero__title')?.textContent || '';
      expect(activeTitle).not.toMatch(/metodi numerici/i);
    });
  });

  test('click su item cambia configurazione attiva nel dettaglio', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await screen.findByRole('button', { name: /aurea dev session/i });

    await user.click(screen.getByRole('button', { name: /aurea dev session/i }));

    await waitFor(() => {
      const activeTitle = container.querySelector('.detail-hero__title')?.textContent || '';
      expect(activeTitle).toMatch(/aurea dev session/i);
    });
  });
});
