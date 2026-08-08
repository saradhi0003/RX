import { createEntity } from "@/lib/entityFactory";
import { withFullName } from "./normalizers";

// `candidates.full_name` is NOT NULL with no default, but the forms collect
// first_name/last_name — see entities/normalizers.js.
export const Candidate = createEntity("candidates", { beforeWrite: withFullName });
