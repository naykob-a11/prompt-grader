import { DEFAULT_PARAMS, PARAMS, type ParamDef } from '@prompt-grader/engine';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { editorStore } from '../../store/editorStore';
import { ParamSlider } from './ParamSlider';

const exposure = PARAMS.find((p) => p.key === 'exposure') as ParamDef;
const hue = PARAMS.find((p) => p.key === 'shHue') as ParamDef;
const slider = () => screen.getByRole('slider') as HTMLInputElement;

beforeEach(() => {
  editorStore.setState({ params: DEFAULT_PARAMS, past: [], future: [], editBase: null });
});
afterEach(cleanup);

test('shows the value and speaks it with its sign', () => {
  editorStore.setState({ params: { ...DEFAULT_PARAMS, exposure: 25 } });
  render(<ParamSlider def={exposure} />);
  expect(screen.getByText('+25')).toBeTruthy();
  expect(slider().getAttribute('aria-valuetext')).toBe('บวก 25');
});

test('speaks negative values and hues in words', () => {
  editorStore.setState({ params: { ...DEFAULT_PARAMS, exposure: -7 } });
  render(<ParamSlider def={exposure} />);
  expect(slider().getAttribute('aria-valuetext')).toBe('ลบ 7');
  cleanup();
  render(<ParamSlider def={hue} />);
  expect(slider().getAttribute('aria-valuetext')).toBe('200 องศา');
  expect(screen.getByText('200°')).toBeTruthy();
});

test('moving the slider updates the store, and releasing it makes one undo step', () => {
  render(<ParamSlider def={exposure} />);
  fireEvent.change(slider(), { target: { value: '30' } });
  fireEvent.change(slider(), { target: { value: '40' } });
  expect(editorStore.getState().params.exposure).toBe(40);
  expect(editorStore.getState().past).toHaveLength(0);
  fireEvent.pointerUp(slider());
  expect(editorStore.getState().past).toHaveLength(1);
});

test('double-clicking the label resets to neutral', () => {
  editorStore.setState({ params: { ...DEFAULT_PARAMS, exposure: 25 } });
  render(<ParamSlider def={exposure} />);
  fireEvent.doubleClick(screen.getByText(exposure.label.th));
  expect(editorStore.getState().params.exposure).toBe(0);
});

test('Shift+arrow moves by ten and stops at the limit', () => {
  editorStore.setState({ params: { ...DEFAULT_PARAMS, exposure: 95 } });
  render(<ParamSlider def={exposure} />);
  fireEvent.keyDown(slider(), { key: 'ArrowRight', shiftKey: true });
  expect(editorStore.getState().params.exposure).toBe(100);
  fireEvent.keyDown(slider(), { key: 'ArrowLeft', shiftKey: true });
  expect(editorStore.getState().params.exposure).toBe(90);
});
