import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { useWorkspaceStore } from '../state/workspaceStore';

describe('App', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    window.localStorage.clear();
  });

  test('renderizza senza crash', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /local presets, one click away/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      const state = useWorkspaceStore.getState();
      expect(Array.isArray(state.workspaces)).toBe(true);
      expect(state.workspaces.length).toBe(0);
      expect(state.hydration.status).toBe('ready');
    });
  });
});
