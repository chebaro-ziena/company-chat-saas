
# AGENT.md

## Project
CompanyHub — multi-tenant SaaS for companies to display products and communicate with customers through real-time chat.

## Tech Stack
- Backend: NestJS, TypeScript, Drizzle ORM, PostgreSQL, Socket.IO
- Frontend: Next.js
- Authentication: JWT in secure HTTP-only cookies

## Architecture
- Backend and frontend are separate projects.
- Backend handles authentication, companies, subscriptions, products, and chat.
- Frontend consumes backend APIs using `credentials: 'include'`.
- API URL: `NEXT_PUBLIC_API_URL` (default: `http://localhost:3000`).
- Socket connection uses the shared `getChatSocket()` utility.

## Business Rules
- Roles: ADMIN, CUSTOMER, TEAM_MEMBER.
- New users register as CUSTOMER by default.
- Customers can browse products and start conversations.
- Company creation and dashboard access require an active PAID subscription.
- PAID plan costs $20/month.
- Payment is development-only for now. Never activate a paid subscription without verified payment.
- Customers can have an OPEN conversation per company/product. Reuse existing OPEN conversations instead of creating duplicates.
- Admins can access conversations belonging to their company.
- Validate all company, product, conversation, and user permissions on the backend.

## Authentication & Security
- Never store JWTs or authentication tokens in localStorage/sessionStorage.
- Use HTTP-only cookies for authentication.
- Always derive sender/user IDs from the authenticated JWT, never trust client-supplied IDs.
- Protect API routes with guards and verify company membership/roles.
- Validate DTOs and user input.
- Never expose secrets or environment variables in frontend code.

## Chat
- Use Socket.IO for real-time messaging.
- Events currently used:
  - `join_conversation`
  - `leave_conversation`
  - `send_message`
  - `new_message`
  - `typing`
- Both customer and company users must join `conversation:${conversationId}`.
- Verify conversation access before joining or sending messages.
- Prevent duplicate messages in frontend state.
- Typing events should identify the sender on the backend.
- Notification sound: `/sounds/message.mp3`.
- Play sound only for incoming messages, not messages sent by the current user or messages loaded initially.

## Coding Rules
- Use TypeScript strictly. Avoid `any`.
- Prefer small reusable components and hooks.
- Keep existing architecture and naming conventions.
- Do not rewrite working features unnecessarily.
- Use Drizzle ORM, not Prisma.
- Handle loading, errors, empty states, and API failures.
- Clean up event listeners, timers, and AbortControllers.
- Avoid unnecessary React effects and state updates.
- Keep frontend and backend types consistent.

## Workflow
1. Inspect existing files before changing anything.
2. Understand related backend/frontend code before modifying an API or feature.
3. Make the smallest complete change.
4. Preserve existing behavior unless explicitly asked to change it.
5. Explain which files changed and why.
6. Provide complete code for changed files when requested.
7. Do not claim code was tested unless it was actually tested.

## Important Preferences
- Prefer practical, production-minded solutions.
- Explain technical decisions briefly.
- Do not suggest Postman; prefer testing through the frontend.
- Ask before introducing new dependencies or changing architecture.
- Never assume a change was applied without checking.
