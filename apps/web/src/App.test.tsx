import 'fake-indexeddb/auto';
import { BUILTIN_PRESETS } from '@prompt-grader/engine';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from './App';
import th from './i18n/th.json';

// The stage needs a real canvas and Worker, which the e2e suite covers.
vi.mock('./features/stage/Stage', () => ({ Stage: () => null }));
vi.mock('./services/openImage', () => ({ openImageFile: vi.fn(), openSampleImage: vi.fn() }));

test('renders the title, every built-in preset and the slider groups', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: th['app.title'] })).toBeTruthy();
  for (const preset of BUILTIN_PRESETS) {
    expect(screen.getByRole('button', { name: new RegExp(`^${preset.name}`) })).toBeTruthy();
  }
  expect(screen.getByLabelText('ความสว่าง (EV)')).toBeTruthy();
});
