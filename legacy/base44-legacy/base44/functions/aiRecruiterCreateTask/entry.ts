import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { run_id, related_entity, related_id, title, description = "", due_date = null, assigned_to = user.email } = body;

    if (!related_entity || !related_id || !title) {
      return Response.json({ error: "related_entity, related_id, and title required" }, { status: 400 });
    }

    // Create task
    const task = await base44.entities.Task.create({
      title,
      description,
      assigned_to,
      related_entity,
      related_id,
      status: "pending",
      priority: "medium",
      due_date,
    });

    // Log activity
    if (run_id) {
      await base44.entities.RecruiterActivity.create({
        run_id,
        entity_type: "task",
        entity_id: task.id,
        activity_type: "ai_task_created",
        title: `Task created: ${title}`,
        description: `AI created follow-up task`,
        metadata: { task_id: task.id, related_entity, related_id },
      });
    }

    return Response.json({
      success: true,
      task_id: task.id,
    });
  } catch (error) {
    console.error("aiRecruiterCreateTask error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});