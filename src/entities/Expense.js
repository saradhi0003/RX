import { createEntity } from "@/lib/entityFactory";
import { withExpenseTitle } from "./normalizers";

// `expenses.title` is NOT NULL but the form writes `name` — see
// entities/normalizers.js.
export const Expense = createEntity("expenses", { beforeWrite: withExpenseTitle });
