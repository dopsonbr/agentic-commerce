import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  effect,
} from '@angular/core';

@Component({
  selector: 'app-quantity-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quantity-input">
      <button
        type="button"
        class="quantity-btn"
        [disabled]="currentValue() <= min()"
        (click)="decrement()"
        aria-label="Decrease quantity"
      >
        -
      </button>
      <input
        type="number"
        class="quantity-value"
        [value]="currentValue()"
        [min]="min()"
        [max]="max()"
        (input)="onInput($event)"
        aria-label="Quantity"
      />
      <button
        type="button"
        class="quantity-btn"
        [disabled]="currentValue() >= max()"
        (click)="increment()"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  `,
  styles: `
    .quantity-input {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 4px;
    }
    .quantity-btn {
      width: 2rem;
      height: 2rem;
      border: none;
      background: var(--color-bg-secondary, #f5f5f5);
      cursor: pointer;
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .quantity-btn:hover:not(:disabled) {
      background: var(--color-bg-hover, #e0e0e0);
    }
    .quantity-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .quantity-value {
      width: 3rem;
      height: 2rem;
      text-align: center;
      border: none;
      border-left: 1px solid var(--color-border, #ddd);
      border-right: 1px solid var(--color-border, #ddd);
      font-size: 1rem;
      -moz-appearance: textfield;
    }
    .quantity-value::-webkit-outer-spin-button,
    .quantity-value::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  `,
})
export class QuantityInput {
  readonly value = input(1);
  readonly min = input(1);
  readonly max = input(99);
  readonly valueChange = output<number>();

  protected readonly currentValue = signal(1);

  constructor() {
    effect(() => {
      this.currentValue.set(this.value());
    });
  }

  protected increment(): void {
    if (this.currentValue() < this.max()) {
      this.currentValue.update((v) => v + 1);
      this.valueChange.emit(this.currentValue());
    }
  }

  protected decrement(): void {
    if (this.currentValue() > this.min()) {
      this.currentValue.update((v) => v - 1);
      this.valueChange.emit(this.currentValue());
    }
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = parseInt(input.value, 10);
    if (isNaN(value)) {
      value = this.min();
    }
    value = Math.max(this.min(), Math.min(this.max(), value));
    this.currentValue.set(value);
    this.valueChange.emit(value);
  }
}
