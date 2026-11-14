import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { migrateLegacyStorage } from './app/core/storage/migrate-legacy-storage';

// Before anything reads the browser's storage: carry over entries saved under the app's old name.
migrateLegacyStorage();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
