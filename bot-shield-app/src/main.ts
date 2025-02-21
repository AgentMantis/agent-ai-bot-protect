import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Create the custom element
const bootstrap = async () => {
  const app = await createApplication(appConfig);
  
  // Define the custom element
  const botShieldElement = createCustomElement(AppComponent, {
    injector: app.injector
  });
  
  // Register the custom element with the browser
  customElements.define('bot-shield', botShieldElement);
};

// Initialize the element
bootstrap().catch(err => console.error('Error initializing bot-shield:', err));
