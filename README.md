# BestPalitan

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Deploying to Cloudflare

This app deploys as a Cloudflare Worker with the Angular production bundle served as static assets. The Worker provides `/api/provider-quotes`, which fetches BC Remit, Nala, LemFi, ACE, Zolt, and Paysend quotes through Cloudflare Browser Rendering, and `/api/reference-rate` for the Google Sheet reference rate. No local Chrome or Express server is needed in production.

1. Authenticate once with `npx wrangler login`.
2. Run `npm run deploy`.

The deployment prints the `*.workers.dev` URL. To validate the production bundle without publishing, run `npm run deploy:dry-run`.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
