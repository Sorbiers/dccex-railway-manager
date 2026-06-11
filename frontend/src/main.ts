import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import {
  APP_CONFIG,
  BACKEND_CONNECTION,
  loadAppConfig,
  resolveBackendConnection
} from './app/services/app-config';

// Resolve the back-end connection from appconfig.json + storage + URL before
// the app boots, then expose both via injection tokens.
loadAppConfig().then((appConfig) => {
  const backend = resolveBackendConnection(appConfig);
  console.log('Resolved back-end connection', backend);

  bootstrapApplication(AppComponent, {
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideAnimationsAsync(),
      { provide: APP_CONFIG, useValue: appConfig },
      { provide: BACKEND_CONNECTION, useValue: backend }
    ]
  }).catch((err) => console.error(err));
});
