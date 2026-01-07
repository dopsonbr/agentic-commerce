import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Subject } from 'rxjs';
import { Action } from '@ngrx/store';
import { AutomationService } from './automation.service';
import { AppState, StoreSnapshot } from './types';

describe('AutomationService', () => {
  let service: AutomationService;
  let store: MockStore<AppState>;
  let actions$: Subject<Action>;
  let originalLocation: Location;

  const initialState: AppState = {
    products: {
      products: [
        {
          sku: '100001',
          name: 'Test Product',
          price: 9.99,
          description: 'Test',
          category: 'test',
          inventory: 10,
          imageUrl: '',
        },
      ],
      selectedProduct: null,
      loading: false,
      error: null,
      searchQuery: '',
    },
    cart: {
      cart: null,
      customerId: '',
      loading: false,
      error: null,
    },
  };

  beforeEach(() => {
    // Save original location
    originalLocation = window.location;
  });

  afterEach(() => {
    // Clean up bridge
    if (window.__agentBridge) {
      delete window.__agentBridge;
    }
    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('when automation=1 is set', () => {
    beforeEach(() => {
      actions$ = new Subject<Action>();

      // Mock URL with automation param
      Object.defineProperty(window, 'location', {
        value: { search: '?automation=1' },
        writable: true,
      });

      TestBed.configureTestingModule({
        providers: [
          AutomationService,
          provideMockStore({ initialState }),
          provideMockActions(() => actions$),
        ],
      });

      store = TestBed.inject(MockStore);
      service = TestBed.inject(AutomationService);
    });

    it('should expose bridge on window', () => {
      expect(window.__agentBridge).toBeDefined();
    });

    it('should report ready status', () => {
      expect(window.__agentBridge?.isReady()).toBe(true);
    });

    it('should return isEnabled true', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return current state snapshot', () => {
      const state = window.__agentBridge?.getState();
      expect(state).toBeDefined();
      expect(state?.products.products).toHaveLength(1);
      expect(state?.products.products[0].sku).toBe('100001');
    });

    it('should resolve on success action', async () => {
      const promise = window.__agentBridge!.dispatchAndWait(
        { type: '[Cart] Add Item', sku: '100001', quantity: 1 } as Action,
        ['[Cart] Add Item Success'],
        ['[Cart] Add Item Failure'],
        1000
      );

      // Emit success action
      actions$.next({
        type: '[Cart] Add Item Success',
        cart: { id: 'cart-1', items: [{ sku: '100001', quantity: 1 }] },
      } as Action);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.action?.type).toBe('[Cart] Add Item Success');
    });

    it('should resolve with error on failure action', async () => {
      const promise = window.__agentBridge!.dispatchAndWait(
        { type: '[Cart] Add Item', sku: 'invalid', quantity: 1 } as Action,
        ['[Cart] Add Item Success'],
        ['[Cart] Add Item Failure'],
        1000
      );

      // Emit failure action
      actions$.next({
        type: '[Cart] Add Item Failure',
        error: 'Product not found',
      } as Action);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Product not found');
    });

    it('should timeout if no response', async () => {
      const promise = window.__agentBridge!.dispatchAndWait(
        { type: '[Cart] Add Item', sku: '100001', quantity: 1 } as Action,
        ['[Cart] Add Item Success'],
        ['[Cart] Add Item Failure'],
        100 // Short timeout for test
      );

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });
  });

  describe('when automation is not set', () => {
    beforeEach(() => {
      actions$ = new Subject<Action>();

      // Mock URL without automation param
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });

      TestBed.configureTestingModule({
        providers: [
          AutomationService,
          provideMockStore({ initialState }),
          provideMockActions(() => actions$),
        ],
      });

      service = TestBed.inject(AutomationService);
    });

    it('should not expose bridge on window', () => {
      expect(window.__agentBridge).toBeUndefined();
    });

    it('should return isEnabled false', () => {
      expect(service.isEnabled()).toBe(false);
    });
  });
});
