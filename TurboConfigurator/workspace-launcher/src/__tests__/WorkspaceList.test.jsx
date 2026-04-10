import { render, screen } from '@testing-library/react';
import WorkspaceList from '../components/WorkspaceList';

const validWorkspace = {
  id: 'ws-1',
  title: 'Metodi Numerici',
  description: 'Sessione studio',
  status: 'Ready',
  category: 'Study',
  executionState: 'Executable now',
  actions: [{ id: 'a1', type: 'OPEN_FOLDER' }],
  trigger: 'Cmd+Opt+1',
};

describe('WorkspaceList', () => {
  test('renderizza con dati validi', () => {
    render(
      <WorkspaceList
        workspaces={[validWorkspace]}
        activeWorkspaceId="ws-1"
        onSelectWorkspace={() => {}}
      />,
    );

    expect(screen.getByText(/metodi numerici/i)).toBeInTheDocument();
    expect(screen.getByText(/1 actions/i)).toBeInTheDocument();
  });

  test('non crasha con workspaces undefined', () => {
    render(<WorkspaceList workspaces={undefined} activeWorkspaceId={null} onSelectWorkspace={() => {}} />);

    expect(screen.getByText(/no workspaces in this group/i)).toBeInTheDocument();
  });

  test('non crasha con workspaces null', () => {
    render(<WorkspaceList workspaces={null} activeWorkspaceId={null} onSelectWorkspace={() => {}} />);

    expect(screen.getByText(/no workspaces in this group/i)).toBeInTheDocument();
  });

  test('gestisce array vuoto', () => {
    render(<WorkspaceList workspaces={[]} activeWorkspaceId={null} onSelectWorkspace={() => {}} />);

    expect(screen.getByText(/pick another group/i)).toBeInTheDocument();
  });

  test('gestisce oggetti incompleti', () => {
    render(
      <WorkspaceList
        workspaces={[{ id: 'ws-2', title: 'Incompleto' }]}
        activeWorkspaceId={null}
        onSelectWorkspace={() => {}}
      />,
    );

    expect(screen.getByText(/incompleto/i)).toBeInTheDocument();
    expect(screen.getByText(/0 actions/i)).toBeInTheDocument();
    expect(screen.getByText(/unknown/i)).toBeInTheDocument();
  });
});
