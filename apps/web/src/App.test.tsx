import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';
import th from './i18n/th.json';

test('renders the app title from i18n', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: th['app.title'] })).toBeTruthy();
});
