import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';

const projectDsn = 'https://550dab04ae5f782d4ff29a00d97a54bc@o4512179105103872.ingest.us.sentry.io/4512179116376064';

// Allow only structural error details. Omit messages, users, requests,
// breadcrumbs, local variables, and source snippets.
export function sanitizeErrorEvent(event: ErrorEvent): ErrorEvent | null {
  if (!event.exception?.values?.length) return null;
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: 'production',
    exception: { values: event.exception.values.map(value => ({
      type: value.type,
      value: '[message omitted for privacy]',
      stacktrace: { frames: value.stacktrace?.frames?.map(frame => ({
        filename: frame.filename?.split(/[?#]/)[0],
        function: frame.function,
        lineno: frame.lineno,
        colno: frame.colno,
        in_app: frame.in_app,
      })) },
    })) },
  };
}

// Local development and preview builds must not report production incidents.
if (import.meta.env.PROD && window.location.origin === 'https://app.deuceiq.com') {
  Sentry.init({
    dsn: projectDsn,
    environment: 'production',
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
      urlQueryParams: false, stackFrameVariables: false, frameContextLines: 0,
      databaseQueryData: false, queues: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    },
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    maxBreadcrumbs: 0,
    tracesSampleRate: undefined,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: sanitizeErrorEvent,
  });
}

// React 19 reports render failures through root callbacks.
export const reportReactError = Sentry.reactErrorHandler();
