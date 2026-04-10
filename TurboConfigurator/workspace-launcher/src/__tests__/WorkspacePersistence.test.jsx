import { createWorkspaceService } from '../services/workspaceService';
import { useWorkspaceStore } from '../state/workspaceStore';
import {
  WORKSPACE_ACTION_TYPES,
  WORKSPACE_CATEGORIES,
  createWorkspace,
  createWorkspaceAction,
} from '../domain/workspaceTypes';

function createMemoryPersistence(initialValue = null) {
  let value = initialValue;

  return {
    async read(defaultValue = null) {
      return value == null ? defaultValue : value;
    },
    async write(nextValue) {
      value = nextValue;
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        value: nextValue,
      };
    },
    async remove() {
      value = null;
    },
    getValue() {
      return value;
    },
  };
}

function createSampleWorkspace(id, name) {
  return createWorkspace({
    id,
    name,
    description: `Workspace ${name}`,
    category: WORKSPACE_CATEGORIES.CODING,
    actions: [
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
        name: 'Open folder',
        folderPath: '~/Documents/Test',
      }),
    ],
  });
}

describe('Workspace persistence', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
  });

  test('first run parte vuoto e inizializza snapshot', async () => {
    const memory = createMemoryPersistence(null);
    const service = createWorkspaceService({ persistence: memory });

    await service.hydrate();

    const state = useWorkspaceStore.getState();
    expect(state.workspaces).toEqual([]);
    expect(state.hydration.status).toBe('ready');

    const persisted = memory.getValue();
    expect(persisted).toBeTruthy();
    expect(persisted.initialized).toBe(true);
    expect(persisted.workspaces).toEqual([]);
  });

  test('salva modifiche e ricarica stato al riavvio', async () => {
    const memory = createMemoryPersistence(null);
    const serviceA = createWorkspaceService({ persistence: memory });

    await serviceA.hydrate();

    const ws1 = createSampleWorkspace('ws-1', 'Alpha');
    const ws2 = createSampleWorkspace('ws-2', 'Beta');

    await serviceA.upsertWorkspace(ws1);
    await serviceA.upsertWorkspace(ws2);
    await serviceA.selectWorkspace(ws2.id);

    useWorkspaceStore.getState().reset();

    const serviceB = createWorkspaceService({ persistence: memory });
    await serviceB.hydrate();

    const reloaded = useWorkspaceStore.getState();
    expect(reloaded.workspaces.map((workspace) => workspace.id)).toEqual(['ws-1', 'ws-2']);
    expect(reloaded.preferences.activeWorkspaceId).toBe('ws-2');
  });

  test('delete persistente: se svuoto tutto, resta vuoto al riavvio', async () => {
    const memory = createMemoryPersistence(null);
    const serviceA = createWorkspaceService({ persistence: memory });

    await serviceA.hydrate();

    const ws = createSampleWorkspace('ws-delete', 'Delete Me');
    await serviceA.upsertWorkspace(ws);
    await serviceA.removeWorkspace(ws.id);

    useWorkspaceStore.getState().reset();

    const serviceB = createWorkspaceService({ persistence: memory });
    await serviceB.hydrate();

    expect(useWorkspaceStore.getState().workspaces).toEqual([]);
  });
});
