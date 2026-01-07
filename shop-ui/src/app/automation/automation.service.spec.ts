import { TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Subject } from 'rxjs';
import { Action } from '@ngrx/store';
import { AutomationService } from './automation.service';
import { AppState } from './types';

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

    it('should reflect state changes in snapshot', () => {
      // Update store state
      store.setState({
        ...initialState,
        cart: {
          cart: {
            id: 'cart-123',
            customerId: 'customer-456',
            items: [{ sku: '100001', quantity: 2 }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          customerId: 'customer-456',
          loading: false,
          error: null,
        },
      });

      const state = window.__agentBridge?.getState();
      expect(state?.cart.cart?.id).toBe('cart-123');
      expect(state?.cart.cart?.items).toHaveLength(1);
      expect(state?.cart.customerId).toBe('customer-456');
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

    it('should extract nested error message', async () => {
      const promise = window.__agentBridge!.dispatchAndWait(
        { type: '[Cart] Add Item', sku: 'invalid', quantity: 1 } as Action,
        ['[Cart] Add Item Success'],
        ['[Cart] Add Item Failure'],
        1000
      );

      // Emit failure action with nested error object
      actions$.next({
        type: '[Cart] Add Item Failure',
        error: { message: 'Nested error message' },
      } as Action);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nested error message');
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

    it('should include state snapshot in result', async () => {
      // Set up state with cart
      store.setState({
        ...initialState,
        cart: {
          cart: {
            id: 'cart-123',
            customerId: 'customer-456',
            items: [{ sku: '100001', quantity: 1 }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          customerId: 'customer-456',
          loading: false,
          error: null,
        },
      });

      const promise = window.__agentBridge!.dispatchAndWait(
        { type: '[Cart] Add Item', sku: '100001', quantity: 1 } as Action,
        ['[Cart] Add Item Success'],
        ['[Cart] Add Item Failure'],
        1000
      );

      actions$.next({
        type: '[Cart] Add Item Success',
        cart: { id: 'cart-123', items: [{ sku: '100001', quantity: 2 }] },
      } as Action);

      const result = await promise;
      expect(result.state).toBeDefined();
      expect(result.state?.cart.cart?.id).toBe('cart-123');
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

  describe('when automation=0 is set', () => {
    beforeEach(() => {
      actions$ = new Subject<Action>();

      // Mock URL with automation=0
      Object.defineProperty(window, 'location', {
        value: { search: '?automation=0' },
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

    it('should not expose bridge when automation is not "1"', () => {
      expect(window.__agentBridge).toBeUndefined();
    });
  });
});
