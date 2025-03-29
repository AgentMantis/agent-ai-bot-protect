// import { createApplication } from '@angular/platform-browser';
// import { createCustomElement } from '@angular/elements';
// import { provideRouter } from '@angular/router';
// import { AppComponent } from './app/app.component';
// import { routes } from './app/app.routes';
// import { appConfig } from './app/app.config';

// // Create the custom element
// const bootstrap = async () => {
//   const app = await createApplication({
//     ...appConfig,
//     providers: [
//       provideRouter(routes)
//     ]
//   });
  
//   // Define the custom element
//   const botShieldElement = createCustomElement(AppComponent, {
//     injector: app.injector
//   });
  
//   // Register the custom element with the browser
//   customElements.define('agent-ai-bot-protect', botShieldElement);
// };

// // Initialize the element
// bootstrap().catch(err => console.error('Error initializing agent-ai-bot-protect:', err));

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
