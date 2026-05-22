# Team Scope Agreement

This project will be handled by 2 developers with clearly separated ownership.

## Developer 1

Developer 1 owns only the patient dashboard scope.

Included work:
- `src/app/patient/dashboard/*`
- patient dashboard UI, layout, presentation, and dashboard-only components
- dashboard-side data display that is specific to the patient dashboard experience

Rules for Developer 1:
- Do not modify code outside the patient dashboard scope unless the change is necessary for connectivity.
- Necessary connectivity changes are limited to shared wiring such as route access, session checks, data fetch helpers, or minimal server-side integration required for the patient dashboard to function.
- Do not refactor unrelated files, shared styles, auth flows, doctor flows, or landing page code unless the change is required to connect the patient dashboard safely.
- If a cross-scope change is required, keep it minimal, targeted, and directly related to dashboard functionality.

## Developer 2

Developer 2 owns everything except the patient dashboard.

Included work:
- authentication flows
- patient signup and signin
- doctor flows
- landing page and shared marketing pages
- shared utilities, backend logic, storage, email, and all non-dashboard features

Rules for Developer 2:
- Avoid changing patient dashboard files unless required for integration or bug fixes that directly affect the full application.
- Preserve Developer 1 ownership within the patient dashboard area whenever possible.

## Shared Boundary Rules

- Developer 1 should stay inside the patient dashboard scope by default.
- Developer 2 should handle all non-dashboard work by default.
- Cross-scope edits are allowed only when necessary for connectivity, integration, security, or blocking defects.
- Any required cross-scope change should be as small as possible and should not contaminate unrelated code.
- Shared helpers should be updated only when there is no clean dashboard-only alternative.
- When touching shared code, keep the change implementation-focused and avoid opportunistic cleanup outside the task.

## Practical Interpretation

Examples of acceptable cross-scope edits for Developer 1:
- adding a minimal data access helper for dashboard data
- adding a session guard needed to protect the patient dashboard route
- adding a tiny integration point required to load patient data into the dashboard

Examples of unacceptable cross-scope edits for Developer 1:
- redesigning patient auth pages
- refactoring shared components unrelated to dashboard rendering
- changing doctor features or landing page behavior
- broad cleanup of utility files that are not required for dashboard connectivity
