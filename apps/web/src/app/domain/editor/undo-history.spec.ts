import { UndoHistory } from './undo-history';

describe('UndoHistory', () => {
  it('undoes and redoes in order', () => {
    const h = new UndoHistory<string>();
    h.push('a');
    h.push('b');
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toBe('a');
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(true);
  });

  it('drops the redo branch when a new step is pushed', () => {
    const h = new UndoHistory<string>();
    h.push('a');
    h.undo();
    h.push('b');
    expect(h.canRedo).toBe(false);
  });

  it('forgets the oldest steps past the cap', () => {
    const h = new UndoHistory<number>(2);
    h.push(1);
    h.push(2);
    h.push(3);
    expect(h.undo()).toBe(3);
    expect(h.undo()).toBe(2);
    expect(h.undo()).toBeUndefined();
  });

  it('clears both stacks', () => {
    const h = new UndoHistory<number>();
    h.push(1);
    h.undo();
    h.clear();
    expect(h.canUndo || h.canRedo).toBe(false);
  });
});
