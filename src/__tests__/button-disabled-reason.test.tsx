/**
 * A disabled Button says why next to it: the given reason, or "Not available".
 * The reason is the button's accessible description. Busy buttons opt out.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button disabled reason', () => {
  it('shows "Not available" next to a disabled button and links it', () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Not available');
    expect(screen.getByText('Not available')).toBeVisible();
  });

  it('shows the given reason', () => {
    render(
      <Button disabled disabledReason="Fill in the required fields first.">
        Submit
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAccessibleDescription(
      'Fill in the required fields first.',
    );
  });

  it('shows nothing when enabled or when only busy', () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.queryByText('Not available')).toBeNull();
    rerender(
      <Button disabled disabledReason={false}>
        Saving…
      </Button>,
    );
    expect(screen.queryByText('Not available')).toBeNull();
    expect(screen.getByRole('button', { name: 'Saving…' })).not.toHaveAttribute('aria-describedby');
  });
});
