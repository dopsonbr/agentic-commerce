import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { productsReducer } from './store/products/products.reducer';
import { cartReducer } from './store/cart/cart.reducer';
import { ProductsEffects } from './store/products/products.effects';
import { CartEffects } from './store/cart/cart.effects';
import { AutomationService } from './automation/automation.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideStore({
      products: productsReducer,
      cart: cartReducer,
    }),
    provideEffects(ProductsEffects, CartEffects),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      trace: false,
      traceLimit: 75,
      connectInZone: true,
    }),
    // Initialize automation service on app start (only activates when ?automation=1)
    {
      provide: APP_INITIALIZER,
      useFactory: (automation: AutomationService) => () => automation,
      deps: [AutomationService],
      multi: true,
    },
  ],
};
