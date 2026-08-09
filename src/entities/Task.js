import { createEntity } from "@/lib/entityFactory";
import { taskWrite, taskRead } from "./normalizers";

// The DB CHECK allows todo/in_progress/done/cancelled; the UI speaks
// pending/in_progress/completed/cancelled — see entities/normalizers.js.
export const Task = createEntity("tasks", { beforeWrite: taskWrite, afterRead: taskRead });
