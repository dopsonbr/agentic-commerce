import { ActionReducer, Action } from '@ngrx/store';
import { LogLevel } from '@grafana/faro-web-sdk';
import { getFaro } from './faro.config';

// Action namespaces to log
const LOGGED_NAMESPACES = ['[Cart]', '[Products]'];

function shouldLogAction(actionType: string): boolean {
  return LOGGED_NAMESPACES.some(ns => actionType.startsWith(ns));
}

export function faroMetaReducer<S>(reducer: ActionReducer<S>): ActionReducer<S> {
  return (state: S | undefined, action: Action) => {
    const faro = getFaro();

    if (faro && shouldLogAction(action.type)) {
      // Log the action as a Faro event
      faro.api.pushEvent('ngrx_action', {
        action_type: action.type,
        action_payload: JSON.stringify(action),
        timestamp: new Date().toISOString(),
      });

      // Also push as a log for Loki correlation
      faro.api.pushLog([`NgRx Action: ${action.type}`], {
        level: LogLevel.INFO,
        context: {
          action_type: action.type,
          payload: JSON.stringify(action),
        },
      });

      // If it's a failure action, log as error
      if (action.type.includes('Failure')) {
        faro.api.pushError(new Error(`NgRx Action Failed: ${action.type}`), {
          type: 'ngrx_failure',
          context: {
            action: JSON.stringify(action),
          },
        });
      }
    }

    return reducer(state, action);
  };
}
