// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { renderSolveAnalysis, setSessionElapsed } from './infoPanel';

describe('timing summary UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <strong id="sessionElapsed"></strong>
      <span id="solve-analysis-status"></span>
      <output id="solve-duration"></output>
      <output id="solve-tps"></output>
      <output id="solve-moves"></output>
      <output id="solve-regrips"></output>
      <output id="solve-triggers"></output>
      <output id="solve-longest-pause"></output>`;
  });

  it('formats session elapsed time as a stable clock badge', () => {
    setSessionElapsed(61_234);
    expect(document.getElementById('sessionElapsed')?.textContent).toBe('1:01.234');
  });

  it('renders a completed solve result with move metrics', () => {
    renderSolveAnalysis({
      status: 'complete',
      durationMs: 12_500,
      tps: 1.6,
      moveCount: 20,
      qtm: 24,
      regrips: 3,
      triggers: 2,
      longestPauseMs: 1_250,
    });

    expect(document.getElementById('solve-analysis-status')?.textContent).toBe('Complete');
    expect(document.getElementById('solve-analysis-status')?.dataset.state).toBe('complete');
    expect(document.getElementById('solve-duration')?.textContent).toBe('0:12.500');
    expect(document.getElementById('solve-tps')?.textContent).toBe('1.60');
    expect(document.getElementById('solve-moves')?.textContent).toBe('20 HTM · 24 QTM');
    expect(document.getElementById('solve-regrips')?.textContent).toBe('3');
    expect(document.getElementById('solve-triggers')?.textContent).toBe('2');
    expect(document.getElementById('solve-longest-pause')?.textContent).toBe('0:01.250');
  });
});
