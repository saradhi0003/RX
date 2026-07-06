// MSW mock server for unit/integration tests (Node environment).
// Intercepts Supabase REST/Auth + LLM HTTP so tests never hit the network.
import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

export const server = setupServer(...handlers);
