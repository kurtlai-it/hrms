/**
 * Language switch end to end: with Bahasa Melayu chosen, the top bar and Home
 * render in BM and <html lang> says so; switching to 中文 in the Me panel
 * changes the screen straight away.
 */
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { setLanguage } from '@/i18n';
import { freshDemoTenant, loginAs } from '../test/helpers';

describe('Language (Bahasa Melayu)', () => {
  // Load the lazy Home chunk up front (see app-shell.test.tsx).
  beforeAll(async () => {
    await import('@/pages/dashboard');
  });

  beforeEach(async () => {
    await freshDemoTenant();
    loginAs('admin', 'admin123');
    setLanguage('ms');
  });
  afterEach(() => setLanguage('en'));

  it('renders the top bar and Home in BM, then switches to 中文 from Me', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /^Menunggu anda · / }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ms');
    expect(screen.getByRole('heading', { level: 2, name: 'Pergi ke' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Semak cuti: Cuti untuk diluluskan/ })).toBeInTheDocument();
    // Leave ("Cuti", maybe with ", 3 menunggu anda"), not Public holidays ("Cuti umum").
    expect(screen.getByRole('link', { name: /^Cuti(,|$)/ })).toBeInTheDocument();

    const header = within(screen.getByRole('banner'));
    // admin is not linked to a staff member: "Helo" alone.
    expect(header.getByText('Helo')).toBeInTheDocument();
    expect(header.getByRole('button', { name: 'Bantuan' })).toBeInTheDocument();

    await user.click(header.getByRole('button', { name: 'Saya' }));
    await user.click(screen.getByRole('button', { name: '中文' }));
    expect(await screen.findByRole('heading', { level: 1, name: /^等您处理 · / })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '前往' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-Hans');
  }, 20000);
});
