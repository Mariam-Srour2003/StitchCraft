/**
 * A bounded undo/redo stack. Framework-free: the owner exposes whatever
 * reactive state it needs (the editor mirrors `size` into signals).
 *
 * Bounded because some steps are whole-pattern snapshots (resize, flip,
 * rotate, palette clean-up); without a cap a long session would keep every
 * one of them alive forever.
 */
export class UndoHistory<T> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];

  constructor(private readonly maxSteps = 200) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Records a new step; any redo branch is discarded, and the oldest step is dropped past the cap. */
  push(step: T): void {
    this.undoStack.push(step);
    if (this.undoStack.length > this.maxSteps) this.undoStack.shift();
    this.redoStack = [];
  }

  /** The step to revert, moved onto the redo stack; undefined when there is nothing to undo. */
  undo(): T | undefined {
    const step = this.undoStack.pop();
    if (step !== undefined) this.redoStack.push(step);
    return step;
  }

  /** The step to re-apply, moved back onto the undo stack; undefined when there is nothing to redo. */
  redo(): T | undefined {
    const step = this.redoStack.pop();
    if (step !== undefined) this.undoStack.push(step);
    return step;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
