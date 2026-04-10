import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RunButton from '../components/RunButton';

describe('RunButton', () => {
  test('click su RunButton non genera errori e invoca handler', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();

    render(<RunButton onClick={onClick} label="Run workspace" />);

    await user.click(screen.getByRole('button', { name: /run workspace/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
