import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  ENVIRONMENT_INITIALIZER,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore, META_REDUCERS } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { productsReducer } from './store/products/products.reducer';
import { cartReducer } from './store/cart/cart.reducer';
import { ProductsEffects } from './store/products/products.effects';
import { CartEffects } from './store/cart/cart.effects';
import { AutomationService } from './automation/automation.service';
import { initFaro } from './observability/faro.config';
import { faroMetaReducer } from './observability/ngrx-faro.meta-reducer';
import { tracingInterceptor } from './observability/tracing.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([tracingInterceptor])),
    provideStore({
      products: productsReducer,
      cart: cartReducer,
    }),
    // Add Faro meta-reducer for NgRx action logging
    {
      provide: META_REDUCERS,
      useValue: faroMetaReducer,
      multi: true,
    },
    provideEffects(ProductsEffects, CartEffects),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      trace: false,
      traceLimit: 75,
      connectInZone: true,
    }),
    // Initialize Faro and automation service on app start
    {
      provide: ENVIRONMENT_INITIALIZER,
      useValue: () => {
        // Initialize Faro for observability
        initFaro();

        // Initialize automation service (only activates when ?automation=1)
        inject(AutomationService);
      },
      multi: true,
    },
  ],
};
